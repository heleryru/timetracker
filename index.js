const express = require('express')

require('dotenv').config()
const app = express()
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
    {id: 1, email: 'admin', password: 'admin'}
]

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
        return res.status(400).send('Invalid email:' + error.code)
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
    users.push({id: maxId + 1, email: req.body.email, password: hashedPassword})

    res.status(201).end('User created')

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
})


