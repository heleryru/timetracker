const express = require('express')
const app = express()
require('dotenv').config()
const {v4: uuidv4} = require('uuid');

const port = process.env.PORT || 3000
const bcrypt = require('bcrypt');
const {verifyEmailDomain} = require('email-domain-verifier');
//Add SwaggerUI
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yml');


app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.static('public'))
app.use(express.json())

const users = [
    {id: 1, email: 'admin', password: '$2b$10$d5du1EQ7p4uNmQzMGiGIG.ABQx4iTjpf7fLOIBdZapJ5zWMSPMw.q'} //KollneKollne
]

const times = [
    {
        id: 1,
        title: 'Time 1',
        content: 'This is the content of time 1',
        userId: 1
    },
    {
        id: 2,
        title: 'Time 2',
        content: 'This is the content of time 2',
        userId: 2
    },
    {
        id: 3,
        title: 'Time 3',
        content: 'This is the content of time 3',
        userId: 1
    }
]

let sessions = [
    {id: '123', userId: 1}
]

function tryToParseJson(jsonString) {
    try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === "object") {
            return o;
        }
    } catch (e) {
    }
    return false;
}

app.post('/users', async (req, res) => {

    //validate email and password
    if (!req.body.email || !req.body.password) return res.status(400).send('Email and password are required')
    if (req.body.password.length < 8) return res.status(400).send('Password must be at least 8 characters long')
    if (!req.body.email.match(/^[+a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)) return res.status(400).send('Email must be in a valid format')

    //Check if email already exists
    if (users.find(user => user.email === req.body.email)) return res.status(409).send('Email already exists')

    //Try to contact the mail server and send a test email without actually sending it
    try {
        const result = await verifyEmailDomain(req.body.email, {smtpNotRequired: process.env.EMAIL_VERIFY_SMTP_NOT_REQUIRED === 'true'})

        if (!result.verified) {
            return res.status(400).send('Email is not valid')
        }
        console.log('Email is valid')
    } catch (error) {
        const errorObject = tryToParseJson(error)
        if (errorObject && errorObject.info) {
            return res.status(400).send('Email is invalid: ' + errorObject.info)
        }
        return res.status(400).send('Email is invalid: ' + error)
    }

    //Hash password
    let hashedPassword
    try {
        hashedPassword = await bcrypt.hash(req.body.password, 10);
    } catch (error) {
        console.error(error);
    }

    //Find max id
    const maxId = users.reduce((max, user) => user.id > max ? user.id : max, users[0].id)

    //Save user to database
    console.log(hashedPassword)
    users.push({id: maxId + 1, email: req.body.email, password: hashedPassword})

    res.status(201).end('User created')

})
app.post('/sessions', async (req, res) => {

    // Validate email and password
    if (!req.body.email || !req.body.password) return res.status(400).send('Email and password are required')

    // Find user in database
    const user = users.find(user => user.email === req.body.email)
    if (!user) return res.status(404).send('User not found')

    // Compare password
    try {
        if (await bcrypt.compare(req.body.password, user.password)) {

            // Create session
            const session = {id: uuidv4(), userId: user.id}

            // Add session to sessions array
            sessions.push(session)

            // Send session to client
            res.status(201).send(session)
        } else {
            // Passwords don't match
            res.status(401).send('Invalid password')
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error')
    }

})

function authorizeRequest(req, res, next) {
    // Check that there is an Authorization header
    if (!req.headers.authorization) return res.status(401).send('Authorization header is missing')

    // Check that the Authorization header is in the correct format
    const authorizationHeader = req.headers.authorization.split(' ')
    if (authorizationHeader.length !== 2 || authorizationHeader[0] !== 'Bearer') return res.status(401).send('Invalid Authorization header')

    // Get the session id from the Authorization header
    const sessionId = authorizationHeader[1]

    // Find the session in the sessions array
    const session = sessions.find(session => session.id === sessionId)
    if (!session) return res.status(401).send('Invalid session id')

    // Check that the user exists
    const user = users.find(user => user.id === session.userId)
    if (!user) return res.status(401).send('Invalid user id')

    // Add user to request object
    req.user = user

    // Add session to request object
    req.session = session

    // Call next middleware
    next()

}

app.get('/times', authorizeRequest, (req, res) => {

    // get times for user
    const timesForUser = times.filter(time => time.userId === req.user.id)

    // Send times to client
    res.send(timesForUser)

})
app.delete('/sessions', authorizeRequest, (req, res) => {

    // Remove session from sessions array
    sessions = sessions.filter(session => session.id !== req.session.id)

    res.status(204).end()

})
// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack)
    const message = err.message || 'Internal Server Error'
    const status = err.status || 500
    res.status(status).send(message)
})


app.listen(port, () => {
    console.log(`App running at http://localhost:${port}. Documentation at http://localhost:${port}/docs`)
});
module.exports = app

