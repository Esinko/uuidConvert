/* Configuration */
const playerdataPath = "./new/" //Folder to copy the UUID files from.
const convertedPlayerdataPath = "./playerdata.converted/" //Folder to copy the converted UUID files to.
const conversionData = "./conversion.json" //The .json file to write the conversion data to. This includes player namesd, offline and online uuids connected.
const disableConversionDataSaving = false //Change this to true if you want to disable the conversion data saving to the conversion file.
/* Modules */
const modules = ["fs", "request", "node-nbt", "zlib"]
var fs = null;
var request = null;
var nbt = null;
var zlib = null;
/* Module verification */
var verified = true
try {
    fs = require("fs")
    request = require("request")
    nbt = require("node-nbt").NbtReader;
    zlib = require("zlib")
}
catch(err){
    verified = false
    console.log("Missing some dependency, installing dependencies. Please wait...")
    installedState = true
    var cp = require("child_process")
    let installed = 0
    modules.forEach(module1 => {
        cp.exec("npm install " + module1).on("exit", async function(){
            console.log("Installed " + module1)
            ++installed
            if(installed == modules.length){
                try {
                    fs = require("fs")
                    request = require("request")
                    nbt = require("node-nbt").NbtReader;
                    zlib = require("zlib")
                }
                catch(err){
                    console.log("Cannot install dependencies automatically, Please install them manually via NPM.")
                    process.exit()
                }
                console.log("Ready to run.", "Starting script in 3 seconds...")
                let time = 4
                let e = setInterval(async function(){
                    time = --time
                    console.log(time)
                    if(time == 0){
                        clearInterval(e)
                        console.log("-------------------------------------------")
                        code()
                    }
                }, 1000)
            }
        })
    })
}
finally {
    if(verified != false){
        code()
    }
}
/* Memory */
var queue = {}
var pending = []
var limit = false
var error_detect = false
var stage = 1
var folderLenght = null
var processed = 0
var log = []
var UI_memory = ""
var old_log = ""
var saved_error = ""
var limit_saved = false
var skip_log = true
var rewrite = []
/* Functions */
async function getOnlineUUID(index){
    let name = queue[index].name
    if(pending.includes(index)) return;
    pending.push(index)
    request.get("https://api.mojang.com/users/profiles/minecraft/" + name, async function(error, response, body){
        if(error != null){
            //Error occured
            error_detect = error
            pending.splice(pending.indexOf(index), 1)
        }else {
            error_detect = false
            if(response.statusCode == 200){
                limit = false
                let uuid = JSON.parse(body).id.toString().split("")
                //Add the -
                uuid[7] = uuid[7] + "-"
                uuid[11] = uuid[11] + "-"
                uuid[15] = uuid[15] + "-"
                uuid[19] = uuid[19] + "-"
                uuid = uuid.join("")
                queue[index].onlineUUID = uuid
                pending.splice(pending.indexOf(index), 1)
                ++processed
            }else {
                if(response.statusCode == 204){
                    request.get("https://api.mojang.com/users/profiles/minecraft/" + name + "?at=0", async function(error, response, body){
                        if(error != null){
                            //Error occured
                            error_detect = error
                            pending.splice(pending.indexOf(index), 1)
                        }else {
                            error_detect = false
                            if(response.statusCode == 200){
                                limit = false
                                let uuid = JSON.parse(body).id.toString().split("")
                                //Add the -
                                uuid[7] = uuid[7] + "-"
                                uuid[11] = uuid[11] + "-"
                                uuid[15] = uuid[15] + "-"
                                uuid[19] = uuid[19] + "-"
                                uuid = uuid.join("")
                                queue[index].onlineUUID = uuid
                                pending.splice(pending.indexOf(index), 1)
                                ++processed
                            }else {
                                if(response.statusCode == 204){
                                    limit = false
                                    ++processed
                                    queue[index].deleted = true
                                    log.push("The user " + queue[index].name + " is deleated.")
                                    pending.splice(pending.indexOf(index), 1)
                                }else {
                                    limit = true
                                    pending.splice(pending.indexOf(index), 1)
                                }
                            }
                        }
                    })
                }else {
                    limit = true
                    pending.splice(pending.indexOf(index), 1)
                }
            }
        }
    })
}
async function writeRenamed(index, callback){
    fs.copyFile(playerdataPath + queue[index].filename, convertedPlayerdataPath + queue[index].onlineUUID + ".dat", async function(error){
        if(error != null){
            error_detect = error
            rewrite.push(index)
        }else {
            callback(true)
        }
    })
}
async function saveDataFile(callback){
    fs.writeFile(conversionData, JSON.stringify(queue), async function(error){
        if(error != null){
            console.log("Cannot save conversion data due to an error: " + error)
            process.exit()
        }else {
            callback(true)
        }
    })
}
async function getOfflineData(index, callback){
    try {
        if(fs.existsSync(playerdataPath + queue[index].filename)){
            let crDir = __dirname + playerdataPath.replace(".", "") + queue[index].filename
            fs.readFile(crDir, async function(error, data){
                if(error != null){
                    console.log("Error reading file: " + crDir, "Please make sure it's not corrupt.", "Developer data:")
                    console.log(queue[index] + " | " + crDir)
                    console.log("Unhandled error from getOfflineData function. [INDEX: " + index + ";DATA:" + queue[index].toString() + "]: " + err);
                    process.exit()
                }else {
                    zlib.gunzip(data, function(err, buffer) {
                        if(err == null){
                            let d = nbt.readTag(buffer);
                            d = nbt.removeBufferKey(d);
                            d.val.forEach(value => {
                                if(value.name == "bukkit"){
                                    value.val.forEach(value2 => {
                                        if(value2.name == "lastKnownName"){
                                            queue[index].name = value2.val
                                            ++processed
                                            callback(index)
                                        }
                                    })
                                }
                            })
                        }else{
                            console.log("Error parsing file: " + crDir, "Please make sure it's not corrupt.", "Developer data:")
                            console.log(queue[index] + " | " + crDir)
                            console.log("Unhandled error from getOfflineData function. [INDEX: " + index + ";DATA:" + queue[index].toString() + "]: " + err);
                            process.exit()
                        }
                    })
                }
            })
        }else {
            log.push("Cannot find file while loading data (" + index + "): " + queue[index].filename)
        }
    }
    catch(err){
        console.log("Unhandled error from getOfflineData function. [INDEX: " + index + ";DATA:" + queue[index].toString() + "]: " + err);
    }
}
async function getFileArray(callback){
    if(fs.existsSync(playerdataPath) && fs.existsSync(convertedPlayerdataPath) && fs.lstatSync(playerdataPath).isDirectory() && fs.lstatSync(convertedPlayerdataPath).isDirectory()){
        try {
            let crPath = playerdataPath.replace(".", __dirname)
            fs.readdir(crPath, async function(err, files){
                if(err != null){
                    console.log("Unexpected error while reading playerdata directory:\n" + err)
                    process.exit()
                }else {
                    if(files.length == 0){
                        console.log("Nothing to read in playerdata folder.")
                        process.exit()
                    }else {
                        folderLenght = files.length
                        let index = -1 //-1 as index starts from 0
                        let added = 0
                        files.forEach(async function(file){
                            ++added
                            index = ++index
                            queue[index] = {
                                name: null,
                                filename: file,
                                onlineUUID: null,
                                deleted: false
                            }
                            if(added == files.length){
                                callback(queue)
                            }
                        })
                    }
                }
            })
        }
        catch(err){
            console.log("Unexpected error while reading playerdata directory:\n" + err)
            process.exit()
        }
    }else {
        console.log("The provided file paths are invalid. Please make sure both of the directories are valid and that they exist.")
        process.exit()
    }
}
async function logging(mode){
    if(old_log == processed && skip_log == true && error_detect == saved_error && limit == limit_saved){
        setTimeout(async function(){
            logging(mode)
        }, 10)
    }else {
        limit_saved = limit
        saved_error = error_detect
        old_log = processed
        console.clear()
        if(log != undefined){
            console.log(log.join("\n"), "\n-------------------")
        }
        if(mode == 1){
            console.log("UUID conversion tool by Esinko","-","Reading and parsing files(1/3):")
            var bars = folderLenght / 20
            var downloadBars = ""
            for(var i = 0; i * bars < processed;++i){
                downloadBars = downloadBars + "="
            }
            for(var i = 0; downloadBars.length != 20;++i){
                downloadBars = downloadBars + " "
            }
            console.log(processed + "/" + folderLenght)
            console.log("0% [" + downloadBars + "] 100%")
            if(error_detect != false || limit == true){
                console.log("An error is occuring: " + error_detect)
                console.log("Has the API limit been reached: ", (limit == true) ? "No.":"Yes! Please wait 10 minutes or change your public IP address(VPN)")
            }
            console.log("-------------------")
            setTimeout(async function(){
                if(processed != folderLenght && stage == 1){
                    logging(mode)
                }
            }, 1)
        }else if(mode == 2){
            console.log("UUID conversion tool by Esinko","-","Converting files(2/3):")
            var bars = folderLenght / 20
            var downloadBars = ""
            for(var i = 0; i * bars < processed;++i){
                downloadBars = downloadBars + "="
            }
            for(var i = 0; downloadBars.length != 20;++i){
                downloadBars = downloadBars + " "
            }
            setTimeout(async function(){
                console.log(processed + "/" + folderLenght)
                console.log("0% [" + downloadBars + "] 100%")
                console.log("Pending: " + pending.length)
                console.log("-------------------")
                if(error_detect != false || limit == true){
                    console.log("An error is occuring: " + error_detect)
                    console.log("Has the API limit been reached:", (limit == true) ? "Yes! Please wait 10 minutes or change your public IP address (with a VPN).":"No.")
                }
                setTimeout(async function(){
                    if(processed != folderLenght && stage == 2){
                        logging(mode)
                    }
                }, 100)
            }, 100)
        }else if(mode == 3){
            console.log("UUID conversion tool by Esinko","-","Saving files(3/3):")
            var bars = folderLenght / 20
            var downloadBars = ""
            for(var i = 0; i * bars > processed;++i){
                downloadBars = downloadBars + "="
            }
            for(var i = 0; downloadBars.length != 20;++i){
                downloadBars = downloadBars + " "
            }
            setTimeout(async function(){
                console.log(processed + "/" + folderLenght)
                console.log("0% [" + downloadBars + "] 100%")
                console.log("Pending: " + rewrite.length)
                console.log("-------------------")
                if(error_detect == true || limit == true){
                    console.log("An error is occuring: " + error_detect)
                    console.log("Has the API limit been reached: ", (limit == true) ? "No.":"Yes! Please wait 10 minutes or change your public IP address(VPN)")
                }
                setTimeout(async function(){
                    if(processed != folderLenght && stage == 3){
                        logging(mode)
                    }
                }, 100)
            }, 100)
        }else if(mode == 4){
            skip_log = false
            console.log("UUID conversion tool by Esinko","-","Saving conversion data(4/3):")
            if(UI_memory == "...") UI_memory = ""
            else if(UI_memory == "..") UI_memory = "..."
            else if(UI_memory == ".") UI_memory = ".."
            else if(UI_memory == "") UI_memory = "."
            console.log("Please wait", UI_memory)
            setTimeout(async function(){
                if(processed != folderLenght && stage == 4){
                    logging(mode)
                }
            }, 10)
        }else {
            console.log("Unable to determine UI logging mode. Please report this error to the developer.")
            processe.abort("Required static argument missing.")
        }
    }
}
/* Redo loop for failed requests */
setInterval(async function(){
    Object.keys(queue).forEach(username => {
        if(!pending.includes(username) && queue[username].onlineUUID == null && queue[username].deleted == false){
            getOnlineUUID(username)
        }
    })
}, 1)
/* Redo loop for failed write attempts */
setInterval(async function(){
    rewrite.forEach(file => {
                rewrite.splice(rewrite.indexOf(file), 1)
        writeRenamed(file, async function(){
            ++processed
            if(processed == folderLenght){
                if(disableConversionDataSaving == false){
                    stage = 4
                    logging(4)
                    saveDataFile(async function(){
                        console.log("Program finished. No errors.\n")
                        process.exit()
                    })
                }else {
                    console.log("Program finished. No errors.\n")
                    process.exit()
                }
            }
        })
    })
}, 1)

/* Main Code */
async function code(){
    try {
        //Get the files
        let looped = 0
        logging(1)
        getFileArray(async function(data){
            Object.keys(data).forEach(async function(index){
                getOfflineData(index, async function(){
                    ++looped
                    if(looped == Object.keys(data).length){
                        //Get ready for conversion
                        processed = 0
                        stage = 2
                        logging(2)
                        Object.keys(data).forEach(async function(index){
                            getOnlineUUID(index)
                            let t = setInterval(async function(){
                                if(processed == Object.keys(data).length){
                                    clearInterval(t)
                                    processed = 0
                                    stage = 3
                                    logging(3)
                                    Object.keys(queue).forEach(index => {
                                        writeRenamed(index, async function(){
                                            ++processed
                                            if(processed == folderLenght){
                                                if(disableConversionDataSaving == false){
                                                    stage = 4
                                                    logging(4)
                                                    saveDataFile(async function(){
                                                        console.log("Program finished. No errors.\n")
                                                        process.exit()
                                                    })
                                                }else {
                                                    console.log("Program finished. No errors.\n")
                                                    process.exit()
                                                }
                                            }
                                        })
                                    })
                                }
                            }, 1000)
                        })
                    }
                })
            })
        })
    }
    catch(err){
        console.log("Code exection failed.\n" + err)
        process.exit()
    }
}
