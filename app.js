require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const { use } = require('passport');

const port = process.env.PORT || 3000;

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/secrets'
  }, (accessToken, refreshToken, profile, cb) => {
    User.findOrCreate({googleId: profile.id}, (err, user) => {
      return cb(err, user);
    });
  }
));

// passport.use(new FacebookStrategy({
//     clientID: FACEBOOK_APP_ID,
//     clientSecret: FACEBOOK_APP_SECRET,
//     callbackURL: "http://localhost:3000/auth/facebook/callback"
//   }, (accessToken, refreshToken, profile, cb) => {
//     User.findOrCreate({ facebookId: profile.id }, (err, user) => {
//       return cb(err, user);
//     });
//   }
// ));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/secrets');
});

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/secrets', (req, res) => {
  User.find({'secret': {$ne: null}}, (err, users) => {
    if (err) {
      console.log(err);
    } else {
      if (users && req.isAuthenticated()) {
        res.render('secrets', {users: users});
      }
    }
  })
});

app.get('/submit', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
})

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.post('/register', (req, res) => {
  User.register({
    username: req.body.username
  }, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      res.redirect('/register');
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/secrets');
      });
    }
  });
});

app.post('/login', (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, (err) => {
    if (err) {
      console.log('fucking error okay?');
    } else {
      passport.authenticate('local')(req, res, () =>{
        res.redirect('/secrets');  
      });
    }
  });
});

app.post('/submit', (req, res) => {
  const secret = req.body.secret;
  User.findById(req.user.id, (err, user) => {
    if (err) {
      console.log(err);
    } else {
      if (user) {
        user.secret = secret;
        user.save(() => {
          res.redirect('/secrets');
        });
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
