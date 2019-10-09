let CreateJobs = require('CreateJobs');
let AssignJobs = require('AssignJobs');
let ExecuteJobs = require('ExecuteJobs');
let Towers = require('Towers');
let Links = require('Links');
let Terminals = require('Terminals');

module.exports.loop = function () {

    /*for(const creepName in Memory.creeps) {
        const gameCreep = Game.creeps[creepName];
        if(gameCreep === undefined){
            console.log('debug-cleanup creep removed ' + creepName);
            delete Memory.creeps[creepName];
        }
    }*/
    if (!Memory.MemRooms) {
        Memory.MemRooms = new Object();
    }
    Towers.run();
    if (Game.time % 10 === 0) {
        if (Game.time % 30 === 0) { // tick burst from https://docs.screeps.com/cpu-limit.html#Bucket
            CreateJobs.run();
            Links.run();
            Terminals.run();
            if (Game.time % 9000 === 0) {
                console.log('--------------- main reset of memory ---------------');
                for (const memRoomKey in Memory.MemRooms) {
                    const memRoom = Memory.MemRooms[memRoomKey];
                    memRoom.AttachedRooms = undefined;
                    memRoom.PrimaryRoom = undefined;
                    //Memory.buyOrdersHistory = {'lastReset':Game.time};
                    memRoom.links = undefined;
                    if (memRoom.RoomLevel <= 0 && Object.keys(memRoom.RoomJobs).length === 0) {
                        // room is unowned and there are no jobs in it - remove the room
                        console.log('-------- removing unused room ' + memRoomKey + ' from Memory --------');
                        Memory.MemRooms[memRoomKey] = undefined;
                    }
                }
            }
        }
        AssignJobs.run();
    }
    ExecuteJobs.run();
};


// TODO:

// add more jobs:
// TODO FillLabMineral
// TODO EmptyLabMineral
// TODO FillPowerSpawnEnergy
// TODO FillPowerSpawnPowerUnits

// add constructions
// add renewCreep functionality
// cache paths to be reused by creeps
// recycle creeps if there are many idle!

// TODO inefficient problem - creeps can be one tick quicker if I try and move to a new action after a finished action
// TODO ExecuteJobs: move job actions over to use GenericAction