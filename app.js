if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const sanitizeV5 = require('./utils/mongoSanitizeV5.js');
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const path = require('path');
const methodoverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const helmet = require('helmet');
const dburl = process.env.DB_URL || 'mongodb://localhost:27017/yelp-camp';

const campgroundRoutes = require('./routes/campgrounds');
const reviewRoutes = require('./routes/reviews');
const userRoutes = require('./routes/users');

// mongodb://localhost:27017/yelp-camp
mongoose.connect(dburl);

const db = mongoose.connection;

db.on('error',console.error.bind(console, "connection error:"));
db.once('open', () => {
    console.log('Database connected');
});

const { MongoStore } = require('connect-mongo');

const store = MongoStore.create({
    mongoUrl: dburl,
    touchAfter: 24 * 60 * 60
});

store.on('error', function(e) {
    console.log('session store error');
})

const sessionConfig = {
    store,
    name: 'session',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + (1000 * 60 * 60 * 24 * 7),
        maxAge: 1000 * 60 * 60 * 24 * 7
    }

}
app.use(session(sessionConfig));

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'));

app.set('query parser', 'extended');

app.use(express.urlencoded({extended: true}));
app.use(methodoverride('_method'));
app.use(express.static(path.join(__dirname,'public')));

app.use(sanitizeV5({ replaceWith: '_' }));




app.use(flash());
app.use(helmet());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

app.use('/', userRoutes);
app.use('/campgrounds', campgroundRoutes);
app.use('/campgrounds/:id/reviews' ,reviewRoutes);

app.get('/', (req,res) => {
    res.render('home')
});

app.all('/{*path}', (req,res,next) => {
    next(new ExpressError('Page not found', 404));
})

app.use((err,req,res,next) => {
    const {statusCode = 500} = err;
    if(!err.message) err.message = 'something went wrong'
    res.status(statusCode).render('error', {err});
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`);
});
