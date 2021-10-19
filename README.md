# osu!Perú Auth

Fork based on osu!Turkey Auth System.
[Original project (Thank you Coderbora<3)](https://github.com/Coderbora/osuturkiye)

## Requirements

- Node.js version 16 or higher
- MongoDB version 4 or higher
- Discord application with enabled bot account which can be created from [here](https://discord.com/developers/applications)
- osu! OAuth application which can be created from [here](https://osu.ppy.sh/home/account/edit)

## Installation

### Installing dependencies
Firstly, you need to install dependencies with `npm install` command.

### Creating config file
Then, you need to copy the `config.defaults.json` for your actual-use config file: `config.json`

With this action, you can edit values about the project. 

### Building front-end
You can build the front-end with `npm run build:client` command.

### Building server
You can build the server with `npm run build:server` command.

### Running the project
After creating config file and building the front-end, you are ready to run the project with `npm run start`
