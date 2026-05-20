require("dotenv").config();

const port=process.env.PORT || 3000;
const express = require("express");
const app = express();
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const nocache = require("nocache");
const passport = require("./config/passport");

const Database = require("./config/db");
const userRoutes = require("./routes/user");
const adminRoutes = require("./routes/admin");
const paymentRoutes = require("./routes/user/paymentRoutes");

Database();

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(nocache())

app.use(
    session({
      secret: process.env.SESSION_SECRET ||"supersecret",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24
      }
    })
  );

app.use(passport.initialize())
app.use(passport.session())

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRoutes);
app.use('/admin', adminRoutes);
app.use('/payment', paymentRoutes);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})