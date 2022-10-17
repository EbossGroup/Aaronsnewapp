var express = require("express");
const axios = require("axios");
var app = express();
var cors = require("cors");
const bodyParser = require("body-parser"); //bodyparser to json
var fs = require("fs"); //store, access, read, write, rename files
let vCardsJS = require("vcards-js"); //vCards to import contacts into Outlook, iOS, Mac OS, and Android devices from your website or application
const FormData = require("form-data"); //Package to create readable "multipart/form-data" streams.
require("dotenv").config(); //Process.env will store all the process files
const { v4: uuidv4 } = require("uuid"); //Universally Unique IDentifier
let vCard = vCardsJS(); // This is your vCard instance, that represents a single contact file
let resp = "";
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    req.header("access-control-request-headers")
  );
  res.setHeader("content-type", "application/json");
  req.header("Accept", "application/json");
  next();
});
//Get request on root
app.get("/", function (req, res) {
  res.send("Hello");
});

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
app.post("/update", async function (req, res) {
  let params = req.body;

  let getVcf = await generateVcf(params);
  if (getVcf.code == 200) {
    let uploadCareResp = await uploadVcftoUploadCare(getVcf.filename);
    if (uploadCareResp.code == 200) {
      let vcardPath = await updateVcardPath(uploadCareResp.data, params.id);
      if (vcardPath.code == 200) {
        res.send({ success: "Data updated successfully!" });
      } else {
        res.send({ error: "something went wrong!" });
      }
    } else {
      res.send({ error: "something went wrong!" });
    }
  } else {
    res.send({ error: "something went wrong!" });
  }
});

//Axios POST object request with Parameters
app.post("/addqrcode", async function (req, res) {
  let params = req.body;
  let insertDate = await insertQrData(params);
  if (insertDate.code == 201) {
    let getQrCode = await generateQr(insertDate.qr_id);

    if (getQrCode.code == 200) {
      let qrPath = await updateQrPath(getQrCode.qr_url, insertDate.qr_id);
      if (qrPath.code == 200) {
        res.send({ success: "Data updated successfully!" });
      } else {
        res.send({ error: "something went wrong1!" });
      }
    } else {
      res.send({ error: "something went wrong2!" });
    }
  } else {
    res.send({ error: "something went wrong3!" });
  }
});

// Access Token generation for Mbiz_card
const getAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.CASPIO_AUTHTOKEN_PATH}`,
      `grant_type=client_credentials&client_id=${process.env.CASPIO_CLIENTID}&client_secret=${process.env.CASPIO_SECRET_KEY}`
    );
    let myAccessToken = response.data.access_token; // Global variable ??
    resp = { code: 200, access_token: myAccessToken };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

//Access token generation for QR_code
const getqrAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.CASPIO_QR_GENERATOR_AUTHTOKEN_PATH}`,
      `grant_type=client_credentials&client_id=${process.env.CASPIO_QR_CLIENTID}&client_secret=${process.env.CASPIO_QR_SECRET_KEY}`
    );
    let myAccessToken = response.data.access_token; // Global variable ??
    resp = { code: 200, access_token: myAccessToken };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};


const uploadVcftoUploadCare = async (fileName) => {
  try {
    const form = new FormData();

    // Reading Uploadcare Public key
    form.append("UPLOADCARE_PUB_KEY", process.env.UPLOADCARE_PUB_KEY);
    form.append("file", fs.readFileSync(fileName), fileName);
    // console.log('2',`${process.env.UPLOADCARE_URL}`)
    // This Code is to upload the file from Local to Uploadcare File Server
    const response = await axios.post(`${process.env.UPLOADCARE_URL}`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    let succ = { code: response.status, data: response.data.file };
    return succ;
  } catch (err) {
    return err;
  }
};

// VCF generation code
const generateVcf = async (params) => {
  let vCard = vCardsJS();
  try {
    let u_id = params.id;
    // Set contact properties
    vCard.firstName = params.EditRecordfirstName;
    vCard.lastName = params.EditRecordlastName;
    vCard.email = params.EditRecordemail_primary;
    vCard.homePhone = params.EditRecordphone_cell;
    vCard.url = params.EditRecordmbizcard_url;

    // Add a profile photo by fetching from a URL
    let url = params.EditRecordpicture_url;
    let image = await axios.get(url, { responseType: "arraybuffer" });
    // Convert image to base 64
    let imageBase64 = Buffer.from(image.data).toString("base64");

    // Set vCard photo to the base 64 value of the image
    vCard.photo.embedFromString(imageBase64, "image/jpeg");
    let fileName = `${uuidv4()}.vcf`;
    // Save contact to VCF file
    vCard.saveToFile(fileName);
    resp = { code: 200, filename: fileName };
    // Saving filename to Universally Unique IDentifier
    // return fileName;
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

//Update Mbiz_url to vacrd in CASPIO_MBIZCARD_TABLE_PATH
const updateVcardPath = async (file, u_id) => {
  // console.log(file,u_id);
  let url2 = `${process.env.CASPIO_MBIZCARD_TABLE_PATH}?q.where=user_id='${u_id}'`;

  let filePath = { vcard: `${process.env.UPLOADCARE_PATH + file}/` };

  let accessToken = await getAccessToken();
  // console.log("--",accessToken);
  if (accessToken.code == 200) {
    try {
      const resp2 = await axios.put(url2, filePath, {
        headers: {
          accept: "application/json",
          Authorization: "Bearer " + accessToken.access_token,
        },
      });
      resp = { code: resp2.status };
    } catch (err) {
      resp = { code: 400 };
    }
  } else {
    resp = { code: 401 };
  }
  return resp;
};

// QR code generation using QR.io parameters
const generateQr = async (params) => {
  try {
    let qr_request = {
      apikey: `${process.env.QR_APIKEY}`,
      data: `${process.env.CASPIO_QR_PATH + "details?qrid=" + params}`,
      transparent: "on",
      frontcolor: "#000000",
      marker_out_color: "#000000",
      marker_in_color: "#000000",
      pattern: "default",
      marker: "default",
      marker_in: "default",
      optionlogo: "none",
    };

    const qr_resp = await axios.post(`${process.env.QR_APIPATH}`, qr_request, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    // console.log(qr_resp.data.png);
    resp = { code: 200, qr_url: qr_resp.data.png };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};
// Inserting QR_Code URL to qr_url in CASPIO_QR_GENERATOR_TABLE_PATH
const insertQrData = async (params) => {
  // console.log(file,u_id);
  let url2 = `${process.env.CASPIO_QR_GENERATOR_TABLE_PATH}?response=rows`;
  // console.log(url2);
  let accessToken = await getqrAccessToken();
  // console.log("--",accessToken); return false;
  if (accessToken.code == 200) {
    try {
      const resp2 = await axios.post(url2, params, {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          Authorization: "Bearer " + accessToken.access_token,
        },
      });
      console.log(resp2.status);
      resp = { code: resp2.status, qr_id: resp2.data.Result[0].qr_id };
    } catch (err) {
      console.log(err);
      resp = { code: 400 };
    }
  } else {
    resp = { code: 401 };
  }
  return resp;
};

const updateQrPath = async (qr_url, qr_id) => {
  let qr_axios_url = `${process.env.CASPIO_QR_GENERATOR_TABLE_PATH}?q.where=qr_id='${qr_id}'`;
  let accessToken = await getqrAccessToken();
  if (accessToken.code == 200) {
    try {
      let filePath = { 'qr_url': qr_url };
      // console.log(filePath)
      const resp2 = await axios.put(
        qr_axios_url,
        filePath,
        {
          headers: {
            accept: "application/json",
            Authorization: "Bearer " + accessToken.access_token,
          },
        }
      );
      resp = { code: resp2.status };
    } catch (err) {
      resp = { code: 400 };
    }
  } else {
    resp = { code: 401 };
  }
  return resp;
};
//Port Adderess: 5000
var server = app.listen(process.env.PORT || 5000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("app listening", host, port);
});
