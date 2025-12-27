import express from 'express';
import { serverConfig } from './config.ts';
import { middlewareError } from './middlewares/error.middleware.ts';
import manhwasRouter from './routes/manhwas.route.ts';
import morgan from 'morgan';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/manhwas', manhwasRouter);

app.use(morgan('combined'));
app.use(middlewareError);

app.listen(serverConfig.PORT, serverConfig.HOSTNAME, () => {
  console.log(`Server running on http://${serverConfig.HOSTNAME}:${serverConfig.PORT}`);
});
