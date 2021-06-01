const fdebug = require('./fdebug');
const debug = fdebug('movies:lib:movies');

function Movies(main) {
  this.db = main.db;
  this.http = main.libs.http;
  debug('init');
}

Movies.prototype.add = function add(params) {
  const self = this;
  debug('.add called');
  return new Promise((resolve, reject) => {
    self.db.movies.insert(params, (err, doc) => err ? reject(err) : resolve(doc));
  });
};

Movies.prototype.searchIMDB = function searchIMDB(title) {
  const self = this;
  debug('searchIMDB called');
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.omdbapi.com',
      port: 80,
      path: `/?y=&plot=full&r=json&type=movie&s=${title}&apikey=349df3c7`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    let body = '';
    const req = self.http.request(options, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
};


Movies.prototype.saveToDB = function(movies){
    var self = this;
    var promises = [];
    debug(".saveToDB called");


        movies.forEach((m)=>{

            promises.push(new Promise((resolve, reject)=>{
            self.db.movies.findOne({imdbID:m.imdbID}, {}, (err, doc)=>{
                    if(err) return reject(err);
                    if(!doc) {
                        m.search=(()=>{
                            let s=m.Title;
                            s = s.toLowerCase();
                            s = s.replace("á", "a");
                            s = s.replace("é", "e");
                            s = s.replace("í", "i");
                            s = s.replace("ó", "o");
                            s = s.replace("ú", "u");
                            return s;
                        })();
                        self.db.movies.save(m, (e,d)=>{
                            debug("inserted: "+JSON.stringify(d));
                            resolve();
                        });
                    }else resolve();

                });

             })//end promise
            );//end push

        });//end foreach

    return Promise.all(promises);

}

Movies.prototype.search = function search(obj) {
  const self = this;
  let movies = [];
  return new Promise((resolve, reject) => {
    self.searchDB(obj)
      .then((result) => {
        movies = result;
        if (movies.length === 0) {
          return self.searchIMDB(obj.title)
            .then((resultitem) => {
              console.info('resultitem: ', resultitem);
              movies = resultitem.Search;
              return self.saveToDB(resultitem.Search);
            });
        }
        return Promise.resolve(movies);
      })
      .then(() => {
        resolve(movies);
      })
      .catch(reject);
  });
};

Movies.prototype.searchDB = function(obj){
    var self = this;

    debug("search called: "+JSON.stringify(obj));

    return new Promise((resolve, rejec)=>{

        let query = {};

        if(obj.title) query.search = new RegExp(obj.title);
        if(obj.year) query.Year = obj.year;
        if(obj.id) query.imdbID = obj.id;

        self.db.movies.find(query, {}, (err, docs)=>{
            debug(".lib.search movies found: "+docs.length);
            err ? reject(err) : resolve(docs);
        })
    });
}

module.exports = Movies;
