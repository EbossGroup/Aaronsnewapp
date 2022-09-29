var express = require('express');
const axios = require('axios');
var app = express();
const bodyParser = require('body-parser');//bodyparser to json
var fs = require("fs"); //store, access, read, write, rename files
let vCardsJS = require('vcards-js');//vCards to import contacts into Outlook, iOS, Mac OS, and Android devices from your website or application
const FormData = require('form-data'); //Package to create readable "multipart/form-data" streams.
require('dotenv').config(); //Process.env will store all the process files
const { v4: uuidv4 } = require('uuid');
let vCard = vCardsJS();// This is your vCard instance, that represents a single contact file

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

// Reading Uploadcare Public key
form.append('UPLOADCARE_PUB_KEY', process.env.UPLOADCARE_PUB_KEY);
form.append('file', fs.readFileSync(fileName), fileName);

// This Code is to upload the file from Local to Uploadcare File Server
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

//Port Adderess: 5000
var server = app.listen(5000, function () {
var host = server.address().address
var port = server.address().port
console.log("app listening", host, port)
})


