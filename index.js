const express = require('express')
const path = require('path')
const axios = require('axios')
const PORT = process.env.PORT || 5000
let ejs = require('ejs');
const url = require('url');
const querystring = require('querystring');
const http = require('http');
//set up an array to push information to it
let myDataRes =[];

// set up the async call to the api

const getPokemon  = async (res) => {

  if(myDataRes.length > 0){
    myDataRes.splice(0, myDataRes.length)
  }
 
  let baseURL = 'https://pokeapi.co/api/v2/'
  let urly = 'pokemon?limit=100000&offset=0';
    try {
        const resp = await axios.get(baseURL + urly, 
          {headers:{
            'accept': 'application/json'
          }
     
          });

          myDataRes.push(JSON.stringify(resp.data.results[0].name))

        res.render('pages/index', { article:myDataRes})


    } catch (err) {
        console.error(err);
    }
};

//where the app actually starts above is just defining what happens below.
express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .all('*', (req, res) =>{
    res.header( "Access-Control-Allow-Origin", "*" );

    res.header( "Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE" );
    res.header( "Access-Control-Allow-Headers", req.header( 'access-control-request-headers' ) );
    res.setHeader('content-type', 'application/json');
  
       
    getPokemon(res) 

   
  })

  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



