const app = require('./app');
const config = require('./config');

app.listen(config.port, '127.0.0.1', () => {
  console.log(`SHK-Report démarré sur http://127.0.0.1:${config.port} (${config.nodeEnv})`);
});
