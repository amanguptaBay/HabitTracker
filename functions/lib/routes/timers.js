"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const date_1 = require("../date");
const router = (0, express_1.Router)();
/** GET /timers — list all currently active timers */
router.get('/', async (req, res) => {
    const { uid } = req;
    const snap = await admin.firestore().collection(`users/${uid}/activeTimers`).get();
    res.json(snap.docs.map(d => d.data()));
});
/**
 * POST /timers/:targetId
 * Body: { "targetType": "goal" | "routine" }
 * Returns 409 if a timer is already running for this target.
 */
router.post('/:targetId', async (req, res) => {
    const { uid } = req;
    const { targetId } = req.params;
    const { targetType } = req.body;
    if (targetType !== 'goal' && targetType !== 'routine') {
        res.status(400).json({ error: '"targetType" must be "goal" or "routine"' });
        return;
    }
    const timerRef = admin.firestore().doc(`users/${uid}/activeTimers/${targetId}`);
    const existing = await timerRef.get();
    if (existing.exists) {
        res.status(409).json({ error: 'Timer already running for this target', timer: existing.data() });
        return;
    }
    const timer = { targetId, targetType, startedAt: new Date().toISOString() };
    await timerRef.set(timer);
    res.status(201).json(timer);
});
/**
 * DELETE /timers/:targetId
 * Stops the timer, writes timing segments (handles midnight splits), returns the result.
 */
router.delete('/:targetId', async (req, res) => {
    var _a;
    const { uid } = req;
    const { targetId } = req.params;
    const timerRef = admin.firestore().doc(`users/${uid}/activeTimers/${targetId}`);
    const timerSnap = await timerRef.get();
    if (!timerSnap.exists) {
        res.status(404).json({ error: 'No active timer for this target' });
        return;
    }
    const timer = timerSnap.data();
    const endTime = new Date().toISOString();
    // Read user's timezone so midnight-split is correct
    const settingsSnap = await admin.firestore().doc(`users/${uid}/settings/preferences`).get();
    const timezone = settingsSnap.exists ? (_a = settingsSnap.data().timezone) !== null && _a !== void 0 ? _a : 'UTC' : 'UTC';
    // Delete active timer first so the mobile app stops showing it immediately
    await timerRef.delete();
    // Split the run across logical day boundaries and accumulate into TimingSegments
    const chunks = (0, date_1.splitByLogicalDay)(timer.startedAt, endTime, timezone);
    await Promise.all(chunks.map(chunk => {
        const segRef = admin.firestore()
            .doc(`users/${uid}/dates/${chunk.date}/timingSegments/${targetId}`);
        return segRef.set({
            targetId,
            targetType: timer.targetType,
            date: chunk.date,
            totalMs: firestore_1.FieldValue.increment(chunk.durationMs),
            segments: firestore_1.FieldValue.arrayUnion({
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                durationMs: chunk.durationMs,
            }),
        }, { merge: true });
    }));
    res.json({
        stopped: true,
        targetId,
        startedAt: timer.startedAt,
        endTime,
        segments: chunks.map(c => ({ date: c.date, durationMs: c.durationMs })),
    });
});
exports.default = router;
//# sourceMappingURL=timers.js.map