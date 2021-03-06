import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { HttpError } from './models/error';
import UserRoute from './routes/user.route';
import VideoRoute from './routes/video.route';
import HistoryRoute from './routes/history.route';
import UploadRoute from './routes/upload.route';
import errorMiddleware from './middlewares/error.middleware';

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/users', UserRoute);
app.use('/api/videos', VideoRoute);
app.use('/api/histories', HistoryRoute);
app.use('/api/upload', UploadRoute);

app.use('/health', (req, res) => {
  res.json('ok');
});

app.use(() => {
  throw new HttpError(404, 'No routes found');
});

app.use(errorMiddleware);

export default app;
