const koa = require('koa');
const app = new koa();
const serve = require('koa-static');
const body_parser = require('koa-bodyparser');
const router = require('koa-router');
const routers = new router();
const db = require('./db/database');
const fs = require('fs');
const dns = require('dns');

app.use(body_parser());
app.use(routers.routes());
app.use(serve(__dirname + 'views'));

routers.get('/', async(ctx) => {
    ctx.type = 'html';
    ctx.body = fs.createReadStream('./views/index.html');
});

routers.post('/api/shorturl/new', async(ctx, next) => {
    ctx.state.url = ctx.request.body.url;
    ctx.state.err = {
        "Error" : "invalid URL"
    };
    if(await is_good_url(ctx.state.url))
        await next();
    else
        ctx.body = JSON.stringify(ctx.state.err);
});

routers.post('/api/shorturl/new', async(ctx, next) => {
    let url = ctx.state.url;
    let parse_url = /(((\w|[-])+\.)?\w+\.+\w+)+/i;
    let parsed_url = url.match(parse_url)[0];
    await site_exist(parsed_url, ctx);
    if(ctx.state.is_valid) //is_valid is manipulated in site_exist function
    {
        let exist_in_db = (await find_db({"original_url":url})).length; //check if it is already shortened
        if(!exist_in_db) //if not shortened then...
        {
            let inserted_obj = {
                "original_url" : url,
                "short_url" : (await find_db({})).length+1 //shortened number is incremented to store new
            };
            await db.insert(inserted_obj);
            ctx.body = JSON.stringify(inserted_obj);
        } else {
            let short_url = (await find_db({"original_url" : url}))[0]["short_url"];
            let obj = {
                "original_url" : url,
                "short_url" : short_url
            };
            ctx.body = obj;
        }
    } else { //if hostname do not exist
        ctx.state.err = {
            "error" : "invalid Hostname"
        };
        ctx.body = JSON.stringify(ctx.state.err);
    }
});

routers.get('/api/shorturl/:id', async(ctx) => {
    let id = ctx.params.id;
    let wrong_format = /\D/.test(id); // if it is other than digit
    if(wrong_format)
    {
        ctx.state.err = {
            "Error" : "Wrong Format"
        };
        ctx.body = JSON.stringify(ctx.state.err);
    } else {
        let exist_shorturl = await find_db({"short_url" : +id}); //if requested shortened url is exist
        if(!exist_shorturl.length) //if there is no such shortened url
            ctx.body = {
            "Error" : "No short url found for given input"
            };
        else // else redirect to that url
            ctx.redirect(exist_shorturl[0]["original_url"]);
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log("Server running on : ", PORT);
});

async function site_exist(url, ctx) {
    return new Promise((resolve) => {
        dns.resolve(url, (err, addr) => {
            if(addr) {
                ctx.state.is_valid = 1;
                resolve(1);
            }
            else {
                ctx.state.is_valid = 0;
                resolve(0);
            }
        })
    });
}

async function is_good_url(url) {
    let validation = /(http(s)?:\/\/((.+\.))?(\w)+\.(\w)+[[(\\?(\w|\W)*)]*(\/?(\w|\W)*)*]?)$/;
    if(validation.test(url))
        return 1;
    else
        return 0;
}

async  function find_db(obj) {
    return new Promise((resolve, reject) => {
        db.find(obj, (err, doc) => {
            if(err) reject(err);
            else resolve(doc);
        })
    })
}