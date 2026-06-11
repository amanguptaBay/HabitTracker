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
const date_1 = require("../date");
const router = (0, express_1.Router)();
/** Read the user's stored timezone, falling back to UTC. */
async function getUserTimezone(uid) {
    var _a;
    const snap = await admin.firestore().doc(`users/${uid}/settings/preferences`).get();
    return snap.exists ? (_a = snap.data().timezone) !== null && _a !== void 0 ? _a : 'UTC' : 'UTC';
}
/** Resolve the ?date= query param, defaulting to today in the user's timezone. */
async function resolveDate(uid, dateParam) {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam))
        return dateParam;
    const tz = await getUserTimezone(uid);
    return (0, date_1.getLogicalDate)(tz);
}
/** GET /entries?date=YYYY-MM-DD */
router.get('/', async (req, res) => {
    const { uid } = req;
    const date = await resolveDate(uid, req.query.date);
    const snap = await admin.firestore()
        .collection(`users/${uid}/entries`)
        .where('date', '==', date)
        .get();
    res.json(snap.docs.map(d => (Object.assign(Object.assign({}, d.data()), { id: d.id }))));
});
/**
 * PUT /entries/:goalId?date=YYYY-MM-DD
 * Body: { "completed": true | false | null }
 */
router.put('/:goalId', async (req, res) => {
    const { uid } = req;
    const { goalId } = req.params;
    const { completed } = req.body;
    if (completed !== true && completed !== false && completed !== null) {
        res.status(400).json({ error: '"completed" must be true, false, or null' });
        return;
    }
    const goalSnap = await admin.firestore().doc(`users/${uid}/goals/${goalId}`).get();
    if (!goalSnap.exists) {
        res.status(404).json({ error: 'Goal not found' });
        return;
    }
    const { routineId } = goalSnap.data();
    const date = await resolveDate(uid, req.query.date);
    const entryId = `entry-${goalId}-${date}`;
    const entry = { id: entryId, goalId, routineId, date, completed };
    await admin.firestore()
        .doc(`users/${uid}/entries/${entryId}`)
        .set(entry, { merge: true });
    res.json(entry);
});
exports.default = router;
//# sourceMappingURL=entries.js.map