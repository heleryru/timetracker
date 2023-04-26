const express = require('express')
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000

//Add SwaggerUI
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yml');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.static('public'))
app.use(express.json())


// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack)
    const message = err.message || 'Internal Server Error'
    const status = err.status || 500
    res.status(500).send('Something broke!')
})

app.listen(port, () => {
    console.log(`App running at http://localhost:${port}. Documentation at http://localhost:${port}/docs`)
})



