import { BaseManager } from "./models/IManager";
import { Command } from "./models/ICommands";
import { ApplicationCommand, CommandInteraction } from "discord.js";

import { App } from "../App";

import * as fs from "fs";
import * as path from "path";

export class CommandManager extends BaseManager {
    private commands: Command[] = [];
    private initializedCommands: ApplicationCommand[] = [];

    constructor() {
        super();

        const commandsDir = path.resolve(__dirname, "commands");
        const folderFiles = fs.readdirSync(commandsDir);
        const commandFiles = folderFiles.filter(file => path.extname(file) === ".js");

        commandFiles.forEach(commandFile => {
            const command = this.importCommand(commandFile);
            command.fileName = commandFile;
            this.commands.push(command);
        })
    }

    private importCommand(filename: string): Command {
        /* eslint-disable */ // for importing all of commands
        return require(`./commands/${filename}`).default as Command;
        /* eslint-enable */
    }

    init(): void {
        this.commands.forEach(async command => {
            await this.initCommand(command);
        });
    }

    async initCommand(command: Command): Promise<void> {
        if(this.commands.indexOf(command) === -1) this.commands.push(command);

        const existingAppCommandIndex = this.initializedCommands
            .findIndex(c => c["commandEnum"] == command.commandEnum);

        if(existingAppCommandIndex > -1) {
            const existingAppCommand = this.initializedCommands[existingAppCommandIndex];
            await existingAppCommand.delete();
            this.initializedCommands.splice(existingAppCommandIndex, 1);
        }

        const appCommand = await App.instance.discordClient.discordGuild.commands.create(command);
        appCommand["commandEnum"] = command.commandEnum;
        this.initializedCommands.push(appCommand);

        await App.instance.discordClient.permissionsManager.loadCommandPermission(command.commandEnum);
    }

    async handleInteractions(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply();

        const command = this.commands.find(command => command.name === interaction.commandName);

        // Hardcoded until discord implements the use of slash commands only in certain channels
        if ((interaction.commandName === "mappingstats" && interaction.channelId === App.instance.config.discord.mapperCommandsWhitelist)
                || (interaction.channelId !== App.instance.config.discord.mapperCommandsWhitelist)) {
            const commandReturn = await command.call({ interaction });

            interaction.editReply(commandReturn.message);
    
            if(commandReturn.edit_promise) {
                Promise.resolve(commandReturn.edit_promise).then(edit => {
                    interaction.editReply(edit.message);
                })
            }
        } else {
            interaction.editReply("You cannot use this command in this channel");
        }
        
    }

    getAppCommand(commandEnum: string): ApplicationCommand {
        return this.initializedCommands.find(e => e["commandEnum"] == commandEnum);
    }

    getCommand(commandEnum: string): Command {
        return this.commands.find(e => e["commandEnum"] == commandEnum);
    }

    getPermissionEnumListChoices(): { name: string, value: string }[] {
        const permissionEnums = this.commands.map(c => c.commandEnum);
        permissionEnums.push("PERMISSIONS");
        return permissionEnums.map(e => ({
            name: e,
            value: e
        }));
    }

    async stop(): Promise<void> {
        await App.instance.discordClient.discordGuild.commands.set([]);
    }
}