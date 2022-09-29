var express = require('express');
const axios = require('axios');
var app = express();
const bodyParser = require('body-parser');
var fs = require("fs");
let vCardsJS = require('vcards-js');
const FormData = require('form-data');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
let vCard = vCardsJS();// This is your vCard instance, that
// represents a single contact file

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get('/', function (req, res) {
    res.send('Hello')
})
app.post('/add', function (req, res) {
let params = req.body;
vCard.firstName = params.firstName;
vCard.middleName = params.middleName;
let fileName = `${uuidv4()}.vcf`;
let upload = vCard.saveToFile(fileName); // Save contact to VCF file
const form = new FormData();
form.append('UPLOADCARE_PUB_KEY', process.env.UPLOADCARE_PUB_KEY);
form.append('file', fs.readFileSync(fileName), fileName);

const response = axios.post(
`${process.env.UPLOADCARE_URL}`,form,{
headers: {
...form.getHeaders()
}
});
response.then(data => {
    res.send({"filepath" : `${process.env.UPLOADCARE_PATH+data.data.file}/`});
    }, (error) => {
    res.error(error.message);
    })
})

var server = app.listen(5000, function () {
var host = server.address().address
var port = server.address().port
console.log("app listening at http://%s:%s", host, port)
})


