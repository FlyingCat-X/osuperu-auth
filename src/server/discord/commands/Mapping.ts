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
                /*
                const bmpSet = (await osuApi.fetchBeatmapSets(
                    user,
                    type,
                    5,
                    1
                )) as OBeatmapSetSchema;
                */
                return {
                    message: {
                        content: 'Feature not implemented'
                    }
                }
            }
        } catch (e) {
            return {
                message: {
                    content: "The user doesn't exist"
                }
            }
        }
    },
};