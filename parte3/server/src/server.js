const app = require('./app');
const { connectDatabase } = require('./config/database');

const port = Number(process.env.PORT || 3000);

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`HelpDesk API escuchando en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo conectar con MongoDB', error);
    process.exitCode = 1;
  });
