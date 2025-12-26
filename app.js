const express = require('express')
const app = express();
const path = require('path');
const env = require('dotenv').config()
const session = require('express-session');
const nocache = require('nocache')
const port = process.env.PORT;
const passport = require('./config/passport')

const Database = require('./config/db')
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes")

const User = require('./models/userSchema');
console.log(User)

Database();


app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(nocache())

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true,
        },
    })
)

app.use(passport.initialize())
app.use(passport.session())

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRoutes);
app.use('/admin', adminRoutes)


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})