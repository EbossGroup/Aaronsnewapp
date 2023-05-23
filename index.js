const express = require("express");
const axios = require("axios");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser"); //bodyparser to json
var fs = require("fs"); //store, access, read, write, rename files
let vCardsJS = require("vcards-js"); //vCards to import contacts into Outlook, iOS, Mac OS, and Android devices from your website or application
const FormData = require("form-data"); //Package to create readable "multipart/form-data" streams.
require("dotenv").config(); //Process.env will store all the process files
const { v4: uuidv4 } = require("uuid"); //Universally Unique IDentifier
let vCard = vCardsJS(); // This is your vCard instance, that represents a single contact file
const request = require("request");
let resp = "";
const path = require("path");
const moment = require('moment');
  
const { urlencoded } = require("body-parser");
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
  res.send({"res" : "Hello"});
});


app.post("/processpayment", async (req, res ) => {
  let accessToken = await getTapeAccessToken();
  if (accessToken.code == 200) {
    try {
      let q = "q.where=Chapter_ID='CF53YQ8'";
      let url2 = `${process.env.CASPIO_TAPESTRY_URL}`+q
      const resp2 = await axios.get(url2, {
        headers: {
          accept: "application/json",
          Authorization: "Bearer " + accessToken.access_token,
        },
      });
      const SECRET_KEY = resp2.data.Result[0].Secret;
      // console.log("---",SECRET_KEY); return false;
      const stripe = require('stripe')(SECRET_KEY);
      let params = req.body;
      // console.log(params); return false;
      let exp_date = params.card_exp_date;
      params.card_exp_month = moment(exp_date).format("MM");
      params.card_exp_year = moment(exp_date).format("YYYY");
    
      try { 
        let paymentData = await createpaymentData(params,stripe);
      // console.log("---", paymentData);return false;
      let custData = await createCustomer(params, paymentData.id,stripe);
      // console.log(custData)
    
      // let attachMethod = await attachpaymentMethod(paymentData.id, custData.id,stripe);
      let subscriptionData = await  subscriptionCreate(custData.id,params.planId,stripe);
    
      resp = { code: 200, message: 'Subscription added successfully' };
      } catch (error) {
        resp = { code: 500, message: error.message };
      }
    } catch (error) {
      resp = { code: 500, message: error.message };
    }
  } 
  
  res.send(resp);
  
});


app.post("/singlepayment", async (req, res) => {
  let params = req.body;
  // const stripe = require("stripe")(SECRET_KEY);
  let q = "q.where=Chapter_ID='CF53YQ8'";
  let url2 = `${process.env.CASPIO_TAPESTRY_URL}`+q
  const resp2 = await axios.get(url2, {
    headers: {
      accept: "application/json",
      Authorization: "Bearer " + accessToken.access_token,
    },
  });
  const SECRET_KEY = resp2.data.Result[0].Secret;
  const stripe = require('stripe')(SECRET_KEY);
  let exp_date = params.card_exp_date;
  params.card_exp_month = moment(exp_date).format("MM");
  params.card_exp_year = moment(exp_date).format("YYYY");
  let accessToken = await getTapeAccessToken();
  console.log(accessToken);
  if (accessToken.code == 200) {
    try {
      let paymentData = await createpayment(params, stripe);
      // console.log("---", paymentData);
      let custData = await createstripeCustomer(params, paymentData.card.brand, stripe);
      console.log(custData);
      let attachMethod = await attachpayment(paymentData.id, custData.id, stripe);
      let paymentintent = await paymentintent(params , custData.id, paymentData.id , stripe)
      console.log(paymentintent)  
    } catch (error) {
      resp = { code: 500, message: error.message };
    }
  }
});

async function createpayment(params, stripe) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: params.card_number,
      exp_month: params.card_exp_month,
      exp_year: params.card_exp_year,
      cvc: params.cvc
    }
  });

  return paymentMethod;
}

async function createstripeCustomer(params, brand, stripe) {
  const customer = await stripe.customers.create({
    source: "tok_" + brand,
    email: params.email,
    name: params.first_name + "." + params.last_name,
  });
  return customer;
}

async function attachpayment(pm_id, cus_id, stripe) {
  const attachpayment = await stripe.paymentMethods.attach(pm_id, {
    customer: cus_id
  });
  return attachpayment;
}

async function paymentintent(params , cus_id , pm_id , stripe){
  let paymentIntent = await stripe.paymentIntents.create({
    payment_method: pm_id,
    amount : params.amount,
    currency: 'usd',
    customer: cus_id,
    confirm: true,
    payment_method_types: ['card']
  
  })
  return paymentIntent;
}


async function createCustomer(params, brand,stripe) {
const customer = await stripe.customers.create({
  source: brand,
  email: params.email,
  name: params.first_name + ' ' + params.last_name
});
return customer;
}
async function createpaymentData(params,stripe) {
const paymentMethod = await stripe.tokens.create({
  // type: "card",
  card: {
    number: params.card_number,
    exp_month: params.card_exp_month,
    exp_year: params.card_exp_year,
    cvc: params.cvc
  }
});

return paymentMethod;
}
async function attachpaymentMethod(pm_id, cus_id,stripe) {
const attachpayment = await stripe.paymentMethods.attach(pm_id, {
  customer: cus_id
});
return attachpayment;
}

async function subscriptionCreate(cus_id , planid,stripe) {
  const subscription = await stripe.subscriptions.create({
    customer: cus_id,
    items: [{ 
     price: planid 
    },
  ],
  });
  return subscription;


}

app.get("/gsp_api", async (req, res) => {
  try {
    let newaccessToken = await getmetalAccessToken();
    if (newaccessToken.code == 200) {
      const response = await axios.get(
        `${process.env.METAL_URL}?access_key=${process.env.ACCESS_KEY}`
      );
      if (response.status == 200 && response.data.success) {
        let currencyData = {
          Gold_Value: response.data.rates.XAU,
          Date: new Date(),
          Silver_Value: response.data.rates.XAG,
          Platinum_Value: response.data.rates.XPT,
        };

        let url2 = `${process.env.CASPIO_METAL_TABLE_PATH}?response=rows`;
        try {
          const resp2 = await axios.post(url2, currencyData, {
            headers: {
              accept: "application/json",
              Authorization: "Bearer " + newaccessToken.access_token,
            },
          });
          resp = {
            code: resp2.status,
            success: "Data inserted successfully!",
          };
        } catch (err) {
          resp = {
            code: 500,
            error: err.message,
          };
        }
      } else {
        resp = {
          code: 500,
          error: response.data.error.info,
        };
      }
    } else {
      resp = {
        code: 500,
        error: "Invalid Access Token",
      };
    }
  } catch (err) {
    resp = {
      code: 500,
      error: err.message,
    };
  }
  res.send(resp);
});

// Axios Post request with Parameters
app.post("/wave_api", async (req, res) => {
  let params = req.body;

  try {
    let customerData = await addCustomerData(params); // Customer create 
    if (customerData.data.customerCreate.didSucceed) {
      console.log(customerData.data.customerCreate.customer);
      let invoiceData = await addInvoiceData(customerData.data,params.product_id1,params.product_id2); // Invoice create
      if (invoiceData.data.invoiceCreate.didSucceed) {
        console.log(invoiceData.data.invoiceCreate.invoice);
        let waveData = await updateWaveCustomerData(customerData.data, invoiceData.data , params.organization_id)// Updating records to table path
        if (waveData.code == 200) {
          resp = {
            code: 200,
            success: "Customer and Invoice updated successfully"
          }
        } else {
          resp = {
            code: 500,
            error: "Cannot update Customer and Invoice tableData"
          }
        }
      } else {
        resp = {
          code: 500,
          error: "Invoice creation Failed ",
        };
      }
    } else {
      resp = {
        code: 500,
        error: "Customer creation Failed ",
      };
    }
  } catch (error) {
    resp = {
      code: 502,
      error: error.message,
    };
  }
  res.send(resp);
});

//Code to create Customer data with parameters
const addCustomerData = async (params) => {
  try {
    const queryData = `mutation ($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      didSucceed
      inputErrors {
        code
        message
        path
      }
      customer {
        id
        name
        firstName
        lastName
        email
        address {
          addressLine1
          addressLine2
          city
          province {
            code
            name
          }
          country {
            code
            name
          }
          postalCode
        }
        currency {
          code
        }
      }
    }
  }
`;
    let addressData = {
      addressLine1: params.addressLine1,
      addressLine2: params.addressLine2,
      city: params.city,
      postalCode: params.zip,
      // countryname : params.country,calling a function or a property on suc
      countryCode: params.country,
    };
    let variableData = {
      input: {
        businessId:
          "QnVzaW5lc3M6NTUzMzg1NmMtMDE1YS00NTI5LTliMDQtZTlkNjY3Nzk1ZWVi",
        name: params.firstName + ' ' + params.lastName,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        address: addressData,
        currency: "CAD",
      },
    };
    

    const config = {
      headers: { Authorization: `Bearer ${process.env.WAVE_AUTH_TOKEN}` },
    };

    const response = await axios.post(
      `${process.env.WAVE_API_ENDPOINT}`,
      {
        query: queryData,
        variables: variableData,
      },
      config
    );
    resp = response.data;
    console.log(resp);
  } catch (error) {
    console.log(error.response.data)
    resp = { code: 400, error: "Something went wrong" };
  }
  return resp;
};

//Code to create Invoice data
const addInvoiceData = async (file,product_id1,product_id2) => {
  try {
    const invoiceData = `mutation ($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        inputErrors {
          message
          code
          path
        }
        invoice {
          id
          createdAt
          modifiedAt
          pdfUrl
          viewUrl
          status
          title
          subhead
          invoiceNumber
          invoiceDate
          poNumber
          customer {
            id
            name
          }
          currency {
            code
          }
          dueDate
          amountDue {
            value
            currency {
              symbol
            }
          }
          amountPaid {
            value
            currency {
              symbol
            }
          }
          taxTotal {
            value
            currency {
              symbol
            }
          }
          total {
            value
            currency {
              symbol
            }
          }
          exchangeRate
          footer
          memo
          disableCreditCardPayments
          disableBankPayments
          itemTitle
          unitTitle
          priceTitle
          amountTitle
          hideName
          hideDescription
          hideUnit
          hidePrice
          hideAmount
          items {
            product {
              id
              name
            }
            description
            quantity
            price
            subtotal {
              value
              currency {
                symbol
              }
            }
            total {
              value
              currency {
                symbol
              }
            }
            account {
              id
              name
              subtype {
                name
                value
              }
            }
            taxes {
              amount {
                value
              }
              salesTax {
                id
                name
              }
            }
          }
          lastSentAt
          lastSentVia
          lastViewedAt
        }
      }
    }
    `;

    let invoiceVariableData = {
      input: {
        status : "SAVED",
        businessId: "QnVzaW5lc3M6NTUzMzg1NmMtMDE1YS00NTI5LTliMDQtZTlkNjY3Nzk1ZWVi",
        customerId: file.customerCreate.customer.id,
        items: [
          {
            productId: product_id1
          },
          {
            productId: product_id2
          }
        ]

      }
    }

    const config = {
      headers: { Authorization: `Bearer ${process.env.WAVE_AUTH_TOKEN}` },
    };

    const response = await axios.post(
      `${process.env.WAVE_API_ENDPOINT}`,
      {
        query: invoiceData,
        variables: invoiceVariableData,
      },
      config
    );
    resp = response.data;
    console.log(resp);
  } catch (error) {
    console.log(error.response.data)
    resp = { code: 400, error: "Something went wrong" };
  }
  return resp;
}
// Code to update the customer and invoice data to caspio tables
const updateWaveCustomerData = async (customer_data, invoice_data, o_id) => {
  let pupdatearams = { 
    Customer_ID: customer_data.customerCreate.customer.id,
    WaveApps_Inv_URL: invoice_data.invoiceCreate.invoice.viewUrl
  }
  let url2 = `${process.env.CASPIO_WAVE_TABLE_PATH}?q.where=Organization_ID='${o_id}'`;
  let newaccessToken = await getWaveAccessToken();
  if (newaccessToken.code == 200) {
    try {
      const resp3 = await axios.put(url2, pupdatearams,{
        headers: {
          accept: "application/json",
          Authorization: "Bearer " + newaccessToken.access_token,
        },
      });
      console.log(resp3)
      resp = { code: resp3.status };
    } catch (err) {
      resp = { code: 400 };
    }
  } else {
    resp = { code: 401 };
  }
  return resp;
}

//Code to generate WavesApps Access Token
const getWaveAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.CASPIO_WAVE_AUTHTOKEN_PATH}`,
      `grant_type=client_credentials&client_id=${process.env.CASPIO_WAVE_CLIENTID}&client_secret=${process.env.CASPIO_WAVE_SECRET_KEY}`
    );
    let myAccessToken = response.data.access_token; // Global variable
    console.log(myAccessToken);
    resp = { code: 200, access_token: myAccessToken };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};
const getmetalAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.CASPIO_AUTHTOKEN_PATH}`,
      `grant_type=client_credentials&client_id=${process.env.CASPIO_METAL_CLIENTID}&client_secret=${process.env.CASPIO_METAL_SECRET_KEY}`
    );
    let myAccessToken = response.data.access_token; // Global variable
    resp = { code: 200, access_token: myAccessToken };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

app.post("/addeventqr", async function (req, res) {
  let params = req.body;
  let getqrcode = await generateTapeStryQr(params);
  if (getqrcode.code == 200) {
    let imageName = getqrcode.qr_url.split("/").pop();
    const dataFile = imageName;
    const url = getqrcode.qr_url;
    const file = fs.createWriteStream(dataFile);
    request(url).pipe(file);

    file
      .on("finish", function () {
        console.log("file download to ", dataFile);
      })
      .on("close", async function () {
        console.log("File Closed ");
        // file is available for reading now
        var datos = fs.readFileSync(dataFile, "utf8");
        let uploadcareqrPath = await eventqruploadcarePath(dataFile);
        if (uploadcareqrPath.code == 200) {
          let removeFile = await deleteFile(__dirname, dataFile);
          res.send({
            success: "Data updated successfully!",
            qr_event_url: `${
              process.env.UPLOADCARE_PATH + uploadcareqrPath.data
            }/`,
          });
        } else {
          res.send({ error: "something went wrong!" });
        }
      });
  } else {
    res.send({ error: "something went wrong2!" });
  }
});

// QR code generation using QR.io parameters
const generateTapeStryQr = async (params) => {
  let url =
    "https://storage.mobilebuilder.net/users/images/6059ce04-40da-4308-bc74-493608bdecf1.png";
  try {
    let image = await axios.get(url, { responseType: "arraybuffer" });
    let contentType =
      image.headers["content-type"] == "image/jpg"
        ? "image/jpeg"
        : image.headers["content-type"];
    console.log(contentType);
    let imageBase64 =
      "data:" +
      contentType +
      ";base64," +
      Buffer.from(image.data).toString("base64");
    let qr_request = {
      apikey: `${process.env.QR_APIKEY}`,
      data: `https://thetapestrynetwork.com/ticket?id=${params.ticket_id}`,
      transparent: "on",
      frontcolor: "#000000",
      marker_out_color: "#829f3d",
      marker_in_color: "#e22d73",
      pattern: "default",
      marker: "flower",
      marker_in: "plus",
      optionlogo: imageBase64,
    };

    const qr_resp = await axios.post(`${process.env.QR_APIPATH}`, qr_request, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    console.log(qr_resp.data.png);
    resp = { code: 200, qr_url: qr_resp.data.png };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

const eventqruploadcarePath = async (fileName) => {
  // console.log('file    name',fileName)
  try {
    const form = new FormData();

    // Reading Uploadcare Public key
    form.append("UPLOADCARE_PUB_KEY", process.env.UPLOADCARE_TAPESTRY_PUB_KEY);
    form.append("file", fs.readFileSync(fileName), fileName);
    console.log("2", `${process.env.UPLOADCARE_URL}`);

    // This Code is to upload the file from Local to Uploadcare File Server
    const response = await axios.post(`${process.env.UPLOADCARE_URL}`, form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    let succ = { code: response.status, data: response.data.file };
    return succ;
  } catch (err) {
    // console.log('Error',err)
    return err;
  }
};
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
    let uploadCareResp = await uploadToUploadCare(getVcf.filename, "vCard");
    if (uploadCareResp.code == 200) {
      let vcardPath = await updateVcardPath(uploadCareResp.data, params.id);
      if (vcardPath.code == 200) {
        res.send({ success: "Data updated successfully!" });
      } else {
        res.send({ error: "something went wrong1!" });
      }
    } else {
      res.send({ error: "something went wrong!" });
    }
  } else {
    res.send({ error: "something went wrong22!" });
  }
});

//Axios POST object request with Parameters
app.post("/addqrcode", async function (req, res) {
  let params = req.body;
  let insertDate = await insertQrData(params);
  if (insertDate.code == 201) {
    let qrUrl = `${
      process.env.CASPIO_QR_PATH + "details?qrid=" + insertDate.qr_id
    }`;
    let getQrCode = await generateQr(qrUrl);

    if (getQrCode.code == 200) {
      let qrPath = await updateQrPath(getQrCode.qr_url, insertDate.qr_id);
      if (qrPath.code == 200) {
        res.send({
          success: "Data updated successfully!",
          qr_url: getQrCode.qr_url,
        });
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

app.post("/mbiz_qrcode", async function (req, res) {
  let params = req.body;
  let user_id = params.user_id
    ? params.user_id
    : res.send({ error: "Please enter valid user id!" });
  let qrUrl = params.mbiz_url
    ? params.mbiz_url
    : res.send({ error: "Please enter valid url!" });
  let pic_url = params.pic_url
    ? params.pic_url
    : res.send({ error: "Please enter valid url!" });

  try {
    let image = await axios.get(pic_url, { responseType: "arraybuffer" });

    // Convert image to base 64
    let contentType =
      image.headers["content-type"] == "image/jpg"
        ? "image/jpeg"
        : image.headers["content-type"];
    console.log(contentType);
    let imageBase64 =
      "data:" +
      contentType +
      ";base64," +
      Buffer.from(image.data).toString("base64");
    let qrConfig = {
      apikey: `${process.env.QR_APIKEY}`,
      data: qrUrl,
      frontcolor: "#000000",
      marker_out_color: "#0071bc",
      marker_in_color: "#62a447",
      pattern: "default",
      marker: "rounded",
      marker_in: "star",
      optionlogo: imageBase64, //params.pic_url,
      no_logo_bg: "off",
    };
    let getQrCode = await generateCustomQr(qrUrl, qrConfig);
    console.log(getQrCode);
    if (getQrCode.code == 200 && getQrCode.qr_url !== "undefined") {
      let imageName = getQrCode.qr_url.split("/").pop();
      const dataFile = imageName;
      const url = getQrCode.qr_url;
      const file = fs.createWriteStream(dataFile);
      request(url).pipe(file);

      file
        .on("finish", function () {
          console.log("file download to ", dataFile);
        })
        .on("close", async function () {
          console.log("File Closed ");
          // file is available for reading now
          var datos = fs.readFileSync(dataFile, "utf8");
          let uploadCareResp = await uploadToUploadCare(dataFile, "mBizCard");
          console.log(uploadCareResp);
          if (uploadCareResp.code == 200) {
            let qrPath = await updateQrTablePath(
              uploadCareResp.data,
              user_id,
              "mBiz"
            );
            if (qrPath.code == 200) {
              let removeFile = await deleteFile(__dirname, dataFile);
              res.send({
                success: "Data updated successfully!",
                qr_mbiz_url: `${
                  process.env.UPLOADCARE_PATH + uploadCareResp.data
                }/`,
              });
            } else {
              res.send({ error: "something went wrong!" });
            }
          } else {
            res.send({ error: "something went wrong!" });
          }
        });
    }
  } catch (error) {
    res.send({ error: "Please enter valid url!" });
  }
});

app.post("/vcard_qrcode", async function (req, res) {
  let params = req.body;
  let user_id = params.user_id
    ? params.user_id
    : res.send({ error: "Please enter valid user id!" });
  let qrUrl = params.vcard_url
    ? params.vcard_url
    : res.send({ error: "something went wrong!" });

  let qrConfig = {
    apikey: `${process.env.QR_APIKEY}`,
    data: qrUrl,
    frontcolor: "#000000",
    marker_out_color: "#62a447",
    marker_in_color: "#0071bc",
    pattern: "default",
    marker: "rounded",
    marker_in: "plus",
    optionlogo: "/images/watermarks/06-vcard.png", //params.pic_url,
    no_logo_bg: "off",
  };
  let getQrCode = await generateCustomQr(qrUrl, qrConfig);
  console.log(getQrCode);
  if (getQrCode.code == 200 && getQrCode.qr_url !== "undefined") {
    let dataFile = getQrCode.qr_url.split("/").pop();
    const url = getQrCode.qr_url;
    const file = fs.createWriteStream(dataFile);
    request(url).pipe(file);
    file
      .on("finish", function () {
        console.log("file download to ", dataFile);
      })
      .on("close", async function () {
        console.log("File Closed ");
        // file is available for reading now
        var datos = fs.readFileSync(dataFile, "utf8");
        let uploadCareResp = await uploadToUploadCare(dataFile, "mBizCard");
        if (uploadCareResp.code == 200) {
          let qrPath = await updateQrTablePath(
            uploadCareResp.data,
            user_id,
            "vCard"
          );
          if (qrPath.code == 200) {
            let removeFile = await deleteFile(__dirname, dataFile);
            res.send({
              success: "Data updated successfully!",
              qr_vcard_url: `${
                process.env.UPLOADCARE_PATH + uploadCareResp.data
              }/`,
            });
          } else {
            res.send({ error: "something went wrong!" });
          }
        } else {
          res.send({ error: "something went wrong!" });
        }
      });
  }
});

const deleteFile = async (dir, file) => {
  await fs.unlinkSync(path.join(dir, file));
  console.log("Deleted");
};

//Access token generation for TApestery_code
const getTapeAccessToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.CASPIO_AUTHTOKEN_PATH}`,
      `grant_type=client_credentials&client_id=${process.env.CASPIO_TAPESTRY_CLIENTID}&client_secret=${process.env.CASPIO_TAPESTRY_SECRETKEY}`
    );
    let myAccessToken = response.data.access_token; // Global variable ??
    resp = { code: 200, access_token: myAccessToken };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

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
    resp = { code: 400, error: "something went wronga!!" };
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

const uploadToUploadCare = async (fileName, type) => {
  try {
    const form = new FormData();

    // Reading Uploadcare Public key
    if (type == "vCard") {
      form.append("UPLOADCARE_PUB_KEY", process.env.UPLOADCARE_PUB_KEY);
    } else {
      form.append("UPLOADCARE_PUB_KEY", process.env.UPLOADCARE_MBIZ_PUB_KEY);
    }
    // fs.readFile(fileName, function (err, data) {
    //   if (err) throw console.log(err);
    //   console.log(data.toString());
    // });
    form.append("file", fs.readFileSync(fileName), fileName);
    console.log(fileName);
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

//Update Mbiz_url to vacrd in CASPIO_MBIZCARD_TABLE_PATH
const updateQrTablePath = async (file, u_id, type) => {
  let url2 = `${process.env.CASPIO_MBIZCARD_TABLE_PATH}?q.where=user_id='${u_id}'`;
  let filePath;
  if (type == "mBiz") {
    filePath = { qr_mbizcard: `${process.env.UPLOADCARE_PATH + file}/` };
  } else {
    filePath = { qr_vcard: `${process.env.UPLOADCARE_PATH + file}/` };
  }
  let accessToken = await getAccessToken();
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
const generateQr = async (url) => {
  try {
    let qr_request = {
      apikey: `${process.env.QR_APIKEY}`,
      data: url,
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
    resp = { code: 200, qr_url: qr_resp.data.png };
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};

// QR code generation using QR.io parameters
const generateCustomQr = async (url, qr_request) => {
  try {
    const qr_resp = await axios.post(`${process.env.QR_APIPATH}`, qr_request, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
    if (qr_resp.data.png) {
      resp = { code: 200, qr_url: qr_resp.data.png };
    } else {
      resp = { code: 400, error: "something went wrong!!" };
    }
  } catch (err) {
    resp = { code: 400, error: "something went wrong!!" };
  }
  return resp;
};
// Inserting QR_Code URL to qr_url in CASPIO_QR_GENERATOR_TABLE_PATH
const insertQrData = async (params) => {
  let url2 = `${process.env.CASPIO_QR_GENERATOR_TABLE_PATH}?response=rows`;
  let accessToken = await getqrAccessToken();
  if (accessToken.code == 200) {
    try {
      const resp2 = await axios.post(url2, params, {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          Authorization: "Bearer " + accessToken.access_token,
        },
      });
      resp = { code: resp2.status, qr_id: resp2.data.Result[0].qr_id };
    } catch (err) {
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
      let filePath = { qr_url: qr_url };
      const resp2 = await axios.put(qr_axios_url, filePath, {
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
//Port Adderess: 5000
var server = app.listen(process.env.PORT || 5000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("app listening", host, port);
});