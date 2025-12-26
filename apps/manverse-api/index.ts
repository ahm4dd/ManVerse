import express from 'express';
import { serverConfig } from './config.ts';
import { middlewareError } from './middlewares/error.middleware.ts';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(middlewareError);

app.listen(serverConfig.PORT, serverConfig.HOSTNAME, () => {
  console.log(`Server running on http://${serverConfig.HOSTNAME}:${serverConfig.PORT}`);
});
