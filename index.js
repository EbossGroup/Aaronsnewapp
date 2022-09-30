var express = require('express');
const axios = require('axios');
var app = express();
var cors = require('cors')
const bodyParser = require('body-parser');//bodyparser to json
var fs = require("fs"); //store, access, read, write, rename files
let vCardsJS = require('vcards-js');//vCards to import contacts into Outlook, iOS, Mac OS, and Android devices from your website or application
const FormData = require('form-data'); //Package to create readable "multipart/form-data" streams.
require('dotenv').config(); //Process.env will store all the process files
const { v4: uuidv4 } = require('uuid'); //Universally Unique IDentifier
let vCard = vCardsJS();// This is your vCard instance, that represents a single contact file

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors())
// app.all('*', (req, res) =>{
//     res.header( "Access-Control-Allow-Origin", "*" );
//     res.header( "Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE" );
//     res.header( "Access-Control-Allow-Headers", req.header( 'access-control-request-headers' ) );
//     res.setHeader('content-type', 'text/xml');
//     req.header( "Accept","application/xml");
//     res.setHeader('content-type', 'application/json');
//     req.header( "Accept","application/json");
//     // Receive Access Token 
//     getAccessToken(res); 
//   })
  
  
//Get request on root 
app.get('/', function (req, res) {
    res.send('Hello')
})



/* 

POST PARAMETERS FROM CASPIO DATA FORM FOR USER ID : UO0J3Y9N4

bUniqueFormId=_46dca72f903c01&
AppKey=7188a000d5e7b01299ce44079c29&
PrevPageID=8&
cbPageType=Details&
ClientQueryString=id%3DUO0J3Y9N4&
pathname=https%3A%2F%2Fc7esh782.caspio.com%2Fdp%2F7188a000d5e7b01299ce44079c29&UpdateRecord=1&
RecordID=2&
Mod0EditRecordPageID=2&
cbCurrentRecordPosition=1&
id=UO0J3Y9N4&
cbFastDetailsPostBack=1&
PivotColumnGroupStates=&
PivotRowGroupStates=&
EditRecordfirstName=Chris&
EditRecordlastName=Vaughan&
EditRecordemail_primary=chris%40ckvaughan.com&
EditRecordphone_cell=336-822-9595&
EditRecordmbizcard_url=https%3A%2F%2Fckvaughan.com&
EditRecordpicture_url=https%3A%2F%2Fstorage.mobilebuilder.net%2Fusers%2Fimages%2F8923c904-b895-4d2c-bc50-9b855b3478fa.jpg

*/

//Axios POST object request with Parameters

app.post('/update', function (req, res) {
let params = req.body;
u_id = params.id; // PK
vCard.firstName = params.EditRecordfirstName;
vCard.lastName = params.EditRecordlastName;
vCard.email = params.EditRecordemail_primary;
vCard.phone = params.EditRecordphone_cell;
let fileName = `${uuidv4()}.vcf`; // Saving filename to Universally Unique IDentifier
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
    // res.send({"mbizcard_url" : `${process.env.UPLOADCARE_PATH+data.data.file}/`});
    let filePath  = {mbizcard_url : `${process.env.UPLOADCARE_PATH+data.data.file}/`};
    /* TODO: integrate Caspio API to update the table 
      https://demo.caspio.com/rest/swagger#/Tables/TablesV2_UpdateRecords 
      tablename: MBizCard_Users
      
      */
      
getAccessToken().then(data => {
    //let url2 = "https://c7esh782.caspio.com/rest/v2/tables/MBizCard_Users/records?q.where.user_id=" + user_id;
  // let url2 = `${https://c7esh782.caspio.com/rest/v1/tables/MBizCard_Users/rows?q={"where":"user_id='UO0J3Y9N4'"}}`;
  let url2 = `https://c7esh782.caspio.com/rest/v2/tables/MBizCard_Users/records?q.where=user_id='${u_id}'`;
    console.log(url2)
          try {
              const resp2 = axios.put(url2,
              filePath,
              {
                headers:{
                'accept': 'application/json',
                'Authorization': "Bearer " + data
                }
              });
              resp2.then(caspData =>{
                console.log(caspData.data.Result)
              }).catch(err =>{
                console.log(err)
              })
                // Example response would be as follows, 
                //     {
                //       "RecordsAffected": 0,
                //       "Result": [
                //         {
                //           "additionalProp1": {},
                //           "additionalProp2": {},
                //           "additionalProp3": {}
                //         }
                //       ]
                //     }
              
              // console.log(resp2);
          } catch (err) {
              console.error(err);
          }
      }).catch(err =>{
        console.log("ERror",err)
      })
      
        
    
    }, (error) => {
    res.error(error.message);
    })
})





const getAccessToken = async () => {
  let urly = 'https://c7esh782.caspio.com/oauth/token';
    try {
        const resp = await axios.post(urly, 'grant_type=client_credentials&client_id=327493aacca44205b3d8ab4e557d05b72bf0a41d988e843456&client_secret=c92ec092f92141e2a67be3ac65727675770b3411cb19b0ba4e');
        let myAccessToken = resp.data.access_token; // Global variable ??
        return myAccessToken;  
    } catch (err) {
        return err;
        // console.error(err);
    }
};

//Port Adderess: 5000
var server = app.listen(process.env.PORT || 5000, function () {
var host = server.address().address
var port = server.address().port
console.log("app listening", host, port)
})
