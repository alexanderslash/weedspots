'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const models = require('../models');
const { describeAll, parseDatabaseName } = require('../schema-describe');

const app = express();
app.use(express.json());

const PORT = process.env.ADMIN_PORT || 4000;
const HOST = process.env.ADMIN_HOST || '127.0.0.1';
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
  console.error('ADMIN_TOKEN not set in .env — aborting');
  process.exit(1);
}

// ─── Auth middleware ─────────────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Build state ────────────────────────────────────────────────────────────
let buildState = { status: 'idle', startedAt: null, finishedAt: null, error: null, log: [] };

// ─── POST /admin/rebuild ────────────────────────────────────────────────────
app.post('/admin/rebuild', auth, (req, res) => {
  if (buildState.status === 'building') {
    return res.status(409).json({ error: 'Build already in progress', startedAt: buildState.startedAt });
  }

  buildState = { status: 'building', startedAt: new Date().toISOString(), finishedAt: null, error: null, log: [] };

  const child = spawn('node', [path.join(__dirname, '..', 'builder', 'build.js')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  child.stdout.on('data', d => {
    const lines = d.toString().split('\n').filter(Boolean);
    buildState.log.push(...lines);
  });
  child.stderr.on('data', d => {
    buildState.log.push('[stderr] ' + d.toString().trim());
  });

  child.on('close', code => {
    buildState.finishedAt = new Date().toISOString();
    if (code === 0) {
      buildState.status = 'done';
    } else {
      buildState.status = 'error';
      buildState.error = `Exit code ${code}`;
    }
  });

  child.on('error', err => {
    buildState.status = 'error';
    buildState.error = err.message;
    buildState.finishedAt = new Date().toISOString();
  });

  res.json({ status: 'building', startedAt: buildState.startedAt });
});

// ─── GET /admin/build-status ────────────────────────────────────────────────
app.get('/admin/build-status', auth, (req, res) => {
  res.json(buildState);
});

// ─── POST /admin/sponsor ───────────────────────────────────────────────────
app.post('/admin/sponsor', auth, async (req, res) => {
  const { placeId, isSponsored, sponsoredUntil } = req.body;

  if (!placeId) return res.status(400).json({ error: 'placeId required' });

  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const Business = mongoose.model('Business');
    const update = { isSponsored: !!isSponsored };
    if (sponsoredUntil) update.sponsoredUntil = new Date(sponsoredUntil);
    else if (!isSponsored) update.sponsoredUntil = null;

    const result = await Business.findOneAndUpdate({ placeId }, update, { new: true });
    if (!result) return res.status(404).json({ error: 'Business not found' });

    res.json({ ok: true, name: result.name, isSponsored: result.isSponsored, sponsoredUntil: result.sponsoredUntil });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/businesses ──────────────────────────────────────────────────
app.get('/admin/businesses', auth, async (req, res) => {
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const Business = mongoose.model('Business');
    const q = req.query.q || '';
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
    const businesses = await Business.find(filter)
      .select('placeId name city category rating reviewCount isSponsored sponsoredUntil scrapedAt updatedAt')
      .sort({ name: 1 })
      .limit(100)
      .lean();
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/businesses/:placeId ────────────────────────────────────────
app.get('/admin/businesses/:placeId', auth, async (req, res) => {
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const { PlaceRaw } = models;
    const { placeId } = req.params;

    const placeRaw = await PlaceRaw.findOne({ placeId }).lean();

    if (!placeRaw) return res.status(404).json({ error: 'Raw data not found' });

    res.json(placeRaw.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/schema ──────────────────────────────────────────────────────
app.get('/admin/schema', auth, (req, res) => {
  try {
    const payload = describeAll({
      Business: models.Business,
      ScrapeQueue: models.ScrapeQueue,
      ScrapeRun: models.ScrapeRun
    });
    payload.database = parseDatabaseName(process.env.MONGODB_URI);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /admin/data-freshness ──────────────────────────────────────────────
app.get('/admin/data-freshness', auth, async (req, res) => {
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const STALE_AFTER_DAYS = Math.max(1, parseInt(process.env.STALE_AFTER_DAYS || '90', 10));
    const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 864e5);
    const Business = mongoose.model('Business');
    const staleFilter = {
      $or: [
        { scrapedAt: { $lt: cutoff } },
        { scrapedAt: { $exists: false } },
        { scrapedAt: null }
      ]
    };
    const total = await Business.countDocuments();
    const staleCount = await Business.countDocuments(staleFilter);
    const bounds = await Business.aggregate([
      { $group: { _id: null, oldest: { $min: '$scrapedAt' }, newest: { $max: '$scrapedAt' } } }
    ]);
    const b = bounds[0] || {};
    res.json({
      staleAfterDays: STALE_AFTER_DAYS,
      totalBusinesses: total,
      staleCount,
      oldestScrapedAt: b.oldest || null,
      newestScrapedAt: b.newest || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health ─────────────────────────────────────────────────────────────────
app.get('/admin/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ─── Start ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Admin server running on http://${HOST}:${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /admin/rebuild       - Trigger site rebuild');
    console.log('  GET  /admin/build-status  - Check build status');
    console.log('  POST /admin/sponsor       - Toggle sponsored listing');
    console.log('  GET  /admin/businesses     - Search businesses')
  console.log('  GET  /admin/businesses/:placeId - Full business doc + raw JSON');
    console.log('  GET  /admin/schema         - Mongoose collections + field types');
    console.log('  GET  /admin/data-freshness - Stale counts vs STALE_AFTER_DAYS');
    console.log('  GET  /admin/health         - Health check');
  });
}

start();
