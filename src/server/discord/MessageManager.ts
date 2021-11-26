import { Message } from "discord.js";
import { App } from "../App";
import { User } from "../models/User";
import { osuApiV2 as osuApi, OUserSchema2 } from "../OsuApiV2";

export class MessageManager {
    async handleMappingTimestamp(message: Message): Promise<void> {
        try {
            const userDb = await User.findOne({ "discord.userId": message.member.id });
            const user = userDb ? userDb.osu.userId.toString() : null;

            const usr = (await osuApi.fetchUserPublic(
                user,
                "osu"
            )) as OUserSchema2;

            if (message.channelId === App.instance.config.discord.mapperCommandsWhitelist) {
                const regexp = /(\d\d:\d\d:\d{3} (?:\(\d+(?:,\d+)*\)))? -(.*)?$/g;
                const match = regexp.exec(message.content);
                
                if (match !== null) {
                    message.channel.send({
                        embeds: [
                            {
                                thumbnail: {
                                    url: (userDb) ? usr.avatar_url : message.author.avatarURL()
                                },
                                title: `${message.author.username} (${message.author.tag}) ${(userDb) ? "| osu! IGN: " + usr.username : ""}`,
                                description:
                                    "**osu! Link:** <osu://edit/" + match[1].replace(" ", "-") + ">\n" +
                                    "**Comments:** " + (match[2] || "None")
                            }
                        ]
                    });
                }
                
            }
        } catch (err) {
            console.log(err);
        }
    }
}