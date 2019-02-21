const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track');
const Schema = mongoose.Schema;

// Setup schemas
const userSchema = new Schema({ username: { type: String, unique: true, required: true } });
const exerciseSchema = new Schema({
    userId: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: Number, required: true, default: 0 },
    date: String,
});

// Setup models
const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Helper function
function isDateValid(date) {
    if (Object.prototype.toString.call(date) === "[object Date]") {
        // it is a date
        if (isNaN(date.getTime())) {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
}

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: 'not found' })
});

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
        .send(errMessage)
});

app.post('/api/exercise/new-user', (req, res) => {
    let username = req.body.username;
    let newUser = new User({ username });
    newUser.save().then(data => res.json({ username: data.username, _id: data._id })).catch(error => res.json({ error: "username already taken" }));
});

app.post('/api/exercise/add', (req, res) => {
    let userId = req.body.userId;
    let description = req.body.description;
    let duration = Number(req.body.duration);
    let date = req.body.date ? new Date(req.body.date) : new Date();
    // Check that date input is valid
    if (isDateValid(date)) {
        if (isNaN(duration)) {
            res.json(`Case to Number failed for value \"${duration}\" at path \"duration\"`);
        } else {
            let newExercise = new Exercise({ userId, description, duration, date });
            newExercise.save()
                .then(data => {
                    res.json({
                        userId: data.userId,
                        description: data.description,
                        duration: data.duration,
                        date: data.date,
                        _id: data._id
                    });
                }).catch(error => res.json("unknown user"));
        }
    } else {
        res.json(`Cast to Date failed for value \"${date}\" at path \"date\"`);
    }
});

app.get('/api/exercise/log', (req, res) => {
    let userId = req.query.userId;
    let from = req.query.from;
    let to = req.query.to;
    let limit = req.query.limit;

    if (limit) limit = Number(limit);
    if (from) from = new Date(from);
    if (to) to = new Date(to);

    if (!(from && isDateValid(from))) {
        res.json(`Cast to Date failed for value \"${from}\" at path \"from\"`);
    }
    if (!(to && isDateValid(to))) {
        res.json(`Cast to Date failed for value \"${to}\" at path \"to\"`);
    }
    if (limit && isNaN(limit)) {
        res.json(`Case to Number failed for value \"${limit}\" at path \"limit\"`);
    }
    let queryObject = { _id: userId };
    if (from && to) {
        queryObject.date = { $gte: from, $lte: to };
    } else if (from) {
        queryObject.date = { $gte: from };
    } else if (to) {
        queryObject.date = { $gte: to };
    }
    let query = Exercise.find(queryObject).populate('User');
    if (limit) query.limit(limit);

    query.exec().then(data => {
        let user = { _id: data[0]._id, username: data[0].username };
        data.forEach(d => {
            delete d._id;
            delete d.username;
        });
        res.json({ _id: user._id, username: user.username, logs: data });
    }).catch(error => res.json("unknown user"))
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
});
