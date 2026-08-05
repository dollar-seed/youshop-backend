process.env.DOTENV_CONFIG_QUIET = 'true';
const app = require("./app");
require("dotenv").config();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`You Shop API listening on port ${PORT}`);
});
