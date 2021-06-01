var myapp = angular.module('myapp', ['ngRoute', 'ngAnimate']);

myapp.$http = null;

myapp.endpoint = "http://192.168.0.123:5000/service";

myapp.basepath = "/";

myapp.galax = function (title) {
    return {
        other: ["$location", function ($location) {
        }]
        , delay: function ($q, $timeout) {
            var _this = this;
            var delay = $q.defer();


            $("#loading").show();
            $(document.body).css("opacity", "0.5");

            $timeout(function () {
                delay.resolve();
                $("#loading").hide();
                $(document.body).css("opacity", "1");

            }, 250);
            return delay.promise;

        }
    };
};


myapp.config(function ($routeProvider, $locationProvider, $httpProvider) {

    $httpProvider.defaults.headers.common["socketid"] = socket.id;

    $("#loading").hide();

    $routeProvider

        .when("/", {
            templateUrl: './pages/home.html',
            controller: 'bodyCtrl',
            resolve: myapp.galax("home")
        })
        .when(myapp.basepath + '404', {
            templateUrl: function () {
                return "./pages/404.html";
            }
            , resolve: myapp.galax("Error 404, invalid page.")
        })
        .when(myapp.basepath+"search/:keyword", {
            templateUrl: './pages/home.html',
            resolve: myapp.galax('search')
        })
        .when(myapp.basepath+'movie/:id', {
            templateUrl: "./pages/movie.html",
            resolve: myapp.galax("movie")
        })

        .otherwise({
            redirectTo: '404'
        });

});



myapp.searchMovies = function(params, cb){

    var id = params.id || "";
    var keyword = params.keyword || "";
    var search = keyword ? "search?title="+keyword : "";


    myapp.$http({
        method: 'GET',
        url: myapp.endpoint+'/movies/'+search
    }).then(function successCallback(response) {
        cb(null, response.data);
    }, function errorCallback(response) {
        cb(response, null);
    });
}


myapp.controller("bodyCtrl", function ($scope, $http, $location) {

    $scope.location = $location;
    myapp.$http = $http;
    myapp.$scope = $scope;

    $scope.search  =function(){
        if($scope.searchInput.trim()!="")
            location.hash="#/search/"+$scope.searchInput;
        else return;
    };
});

myapp.controller("chat", function($scope){

    $scope.messages = [];

    $scope.send = function(){

        socket.emit('chat message', $scope.message);
        $scope.message = "";
    }

    socket.on('chat message', function(msg){
        console.log("llego: ", msg);
        var p = document.createElement("li");
        p.innerHTML = msg;
        document.getElementById("chatMessages").appendChild(p);
    });




});


myapp.controller("movie", function($scope, $http, $location){


    var id = $location.$$path.split("/")[2];

    myapp.searchMovies({id: id}, function(err, movie){
        if(err){
            alert("Error en el server");
        } else{
            $scope.movie = movie[0];
        }
    });

});


myapp.controller("home", function ($scope, $http) {
    console.log("mostrando la home");

    $scope.movie  = [];

    var keyword = "";

    if(location.hash.indexOf("#/search")==0){
        keyword = location.hash.split("/")[2]
    }else keyword = null;


    myapp.searchMovies({keyword: keyword}, function(err, movies){
        if(err){
            alert("Error en el server");
        } else{
            $scope.movies = movies;
        }
    });


});
