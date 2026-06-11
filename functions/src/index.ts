import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';

import { authMiddleware } from './auth';
import routinesRouter from './routes/routines';
import goalsRouter    from './routes/goals';
import entriesRouter  from './routes/entries';
import timersRouter   from './routes/timers';

admin.initializeApp();

const ALLOWED_ORIGINS = [
  'https://amanguptabay.github.io',  // production
  /^http:\/\/localhost(:\d+)?$/,     // local dev / emulator
];

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'] }));
app.options('*', cors({ origin: ALLOWED_ORIGINS }));  // preflight
app.use(express.json());
app.use(authMiddleware);

app.use('/routines', routinesRouter);
app.use('/goals',    goalsRouter);
app.use('/entries',  entriesRouter);
app.use('/timers',   timersRouter);

export const api = functions.https.onRequest(app);
