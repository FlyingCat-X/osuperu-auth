import { User } from "../../models/User";
import { OBeatmapSetSchema, osuApiV2 as osuApi, OUserSchema2 } from "../../OsuApiV2";
import { Command, CommandReturn } from "../models/ICommands";

export default <Command>{
    commandEnum: "MPNG",
    defaultPermission: true,
    name: "mappingstats",
    description: "Displays details about the maps of a player",
    options: [
        {
            name: "type",
            description: "Type of maps to consult",
            type: "STRING",
            choices: ["graveyard", "loved", "pending", "ranked"].map(types => ({
                name: types,
                value: types,
            })),
            required: false
        },
        {
            name: "offset",
            description: "Get another page of the list. (First page = 0) This option only works if you choose a type",
            type: "INTEGER",
            required: false
        },
        {
            name: "user",
            description: "osu! user id or username",
            type: "STRING",
            required: false
        },
        {
            name: "discord",
            description: "Choose a linked discord user",
            type: "USER",
            required: false
        }
    ],
    async call({ interaction }): Promise<CommandReturn> {
        try {
            const guildMember = interaction.options.getUser("discord", false) || interaction.member.user;
            const userDb = await User.findOne({ "discord.userId": guildMember.id });
            const user = interaction.options.getString("user", false) || (userDb ? userDb.osu.userId.toString() : null);
            const type = interaction.options.getString("type", false) as "graveyard" | "loved" | "pending" | "ranked";
            const offset = interaction.options.getInteger("offset", false) || 0;

            if (!userDb) {
                return {
                    message: {
                        content: "The user doesn't have any osu account linked"
                    }
                }
            }

            const ret = (await osuApi.fetchUserPublic(
                user,
                "osu"
            )) as OUserSchema2;

            if (!type) {
                return {
                    message: {
                        embeds: [
                            {
                                author: {
                                    name: `Mapping stats for ${ret.username}`,
                                    url: "https://osu.ppy.sh/users/" + ret.id,
                                    icon_url: `https://osu.ppy.sh/images/flags/${ret.country.code}.png`
                                },
                                thumbnail: {
                                    url: ret.avatar_url
                                },
                                description:
                                    "▸ **Graveyarded maps: **" + ret.graveyard_beatmapset_count + "\n" +
                                    "▸ **Pending maps: **" + ret.pending_beatmapset_count + "\n" +
                                    "▸ **Loved maps: **" + ret.loved_beatmapset_count + "\n" +
                                    "▸ **Ranked and approved maps: **" + ret.ranked_and_approved_beatmapset_count + "\n",
                                footer: {
                                    text: `Kudosu available: ${ret.kudosu.available}/${ret.kudosu.total}`
                                }
                            }
                        ]
                    }
                }
            } else {
                const bmpSet = (await osuApi.fetchBeatmapSets(
                    ret.id,
                    type,
                    5,
                    offset
                )) as OBeatmapSetSchema[];

                let bmpDescription = "";
                bmpSet.forEach(bmp => {
                    bmpDescription += "▸ [" + bmp.artist + " - " + bmp.title + "](" + "https://osu.ppy.sh/beatmapsets/" + bmp.id + ")\n";
                    bmpDescription += "**Difficulties:** " + bmp.beatmaps.length + "\n";
                    bmpDescription += "**Total length:** " + timeConversion(bmp.beatmaps[0].total_length * 1000) + "\n";
                    bmpDescription += "**BPM: **" + bmp.beatmaps[0].bpm + "\n";
                });

                return {
                    message: {
                        embeds: [
                            {
                                author: {
                                    name: `Showing ${ret.username}'s beatmapsets (Page ${offset}) | ${capitalizeFirstLetter(type)}`,
                                    url: "https://osu.ppy.sh/users/" + ret.id,
                                    icon_url: `https://osu.ppy.sh/images/flags/${ret.country.code}.png`
                                },
                                thumbnail: {
                                    url: ret.avatar_url
                                },
                                description: bmpDescription
                            }
                        ]
                    }
                }
            }
        } catch (e) {
            return {
                message: {
                    content: "Error: " + e.message
                }
            }
        }
    },
};

function timeConversion(duration: number) {
    const portions: string[] = [];
  
    const msInHour = 1000 * 60 * 60;
    const hours = Math.trunc(duration / msInHour);
    if (hours > 0) {
      portions.push(hours + ' hours');
      duration = duration - (hours * msInHour);
    }
  
    const msInMinute = 1000 * 60;
    const minutes = Math.trunc(duration / msInMinute);
    if (minutes > 0) {
      portions.push(minutes + ' minutes');
      duration = duration - (minutes * msInMinute);
    }
  
    const seconds = Math.trunc(duration / 1000);
    if (seconds > 0) {
      portions.push(seconds + ' seconds');
    }
  
    return portions.join(' ');
}

function capitalizeFirstLetter(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}