import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import express from 'express';

import { authMiddleware } from './auth';
import routinesRouter from './routes/routines';
import goalsRouter    from './routes/goals';
import entriesRouter  from './routes/entries';
import timersRouter   from './routes/timers';

admin.initializeApp();

const app = express();
app.use(express.json());
app.use(authMiddleware);

app.use('/routines', routinesRouter);
app.use('/goals',    goalsRouter);
app.use('/entries',  entriesRouter);
app.use('/timers',   timersRouter);

export const api = functions.https.onRequest(app);
