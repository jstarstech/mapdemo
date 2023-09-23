require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var usersRouter = require('./routes/users');

var app = express();

app.use(session({
    secret: 'ldUSkdNQQ',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const redis = require("redis");
/*const tile38 = redis.createClient({
    host: process.env.TILE38_HOST,
    port: process.env.TILE38_PORT,
});

const tile38_ctl = redis.createClient({
    host: process.env.TILE38_HOST,
    port: process.env.TILE38_PORT,
});*/

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
});
redisClient.on("error", function(err) {
    console.error(err);
});
redisClient.on("subscribe", function(channel, count) {
    console.log('Channel, Subscribed count:', channel, count)
});
redisClient.subscribe('hub-counts');

app.get('/', function (req, res, next) {
    //req.session

    res.render('index', {title: 'Map'});
});

app.get('/sse', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders(); // flush the headers to establish SSE with client

    const handleMessage = function(channel, message) {
        // console.log("Message: " + message + " on channel: " + channel + " is arrive!");
        function log10(v) {
            return Math.log(v) / Math.log(10);
        }
        max_value = log10(parseInt(process.env.MAX_VALUE || 10000));
        min_alpha = parseFloat(process.env.MIN_ALPHA || 0.1);
        max_alpha = parseFloat(process.env.MAX_ALPHA || 0.9);
        
        function getOpacity(count) {
            return min_alpha + (max_alpha - min_alpha) * log10(parseInt(count)) / max_value;
        }

        if (message.indexOf(",") === -1)
        {
            const [geoHash, hubCount] = message.split(':');

            fillOpacity = getOpacity(hubCount);

            const data = {
                type: 'hub_count',
                ts: new Date(),
                geoHash,
                hubCount,
                // fillOpacity,
            };

            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } else {
            const [ts, ...counts] = message.split(",");
            const items = counts.map(i => {
                return i.split(':');
            });

            const data = {
                type: 'hub_count_bulk',
                ts: new Date(ts * 1000),
                items
            }
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    redisClient.addListener("message", handleMessage);

    // If client closes connection, stop sending events
    res.on('close', () => {
        console.log('client dropped me');
        redisClient.removeListener("message", handleMessage);
        res.end();
    });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
