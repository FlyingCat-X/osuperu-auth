import * as ojsama from "ojsama";
import * as booba from "booba";
import axios from "axios";
import { OBoobaComputeSchema, OCalculationSchema, OUserRecentSchema } from "./OsuApiV2";
import Osu from "./discord/commands/Osu";

export class osuUtil {
    static async calculatePP(recent: OUserRecentSchema, gamemode: "osu" | "mania" | "fruits" | "taiko"): Promise<OCalculationSchema> {
        const osuFile = await axios.get(`https://osu.ppy.sh/osu/${recent.beatmap.id}`, { responseType: 'blob' });

        const parser = new ojsama.parser().feed(osuFile.data.toString());
        const parsedBeatmap = parser.map;

        let boobaCalc;
        switch (gamemode) {
            case "osu": boobaCalc = new booba.std_ppv2().setPerformance(recent); break;
            case "mania": throw new Error("Not yet implemented");
            case "fruits": throw new Error("Not yet implemented");
            case "taiko": throw new Error("Not yet implemented");
            default: throw new Error("You have entered an incorrect gamemode");
        }

        const stars = new ojsama.diff().calc({
            map: parser.map,
            mods: ojsama.modbits.from_string(recent.mods.join(""))
        });
        
        const recentPP = await boobaCalc.compute() as OBoobaComputeSchema;
        const fcPP = await boobaCalc.compute(true) as OBoobaComputeSchema;

        let mapCompletion = 0;

        if (recent.rank === "F") {
            const totalHits = recent.statistics.count_50 + recent.statistics.count_100 + recent.statistics.count_300 + recent.statistics.count_miss;
            const generalCount = Number(parsedBeatmap.objects.length);
            const beatmapHitObjects = [];

            parsedBeatmap.objects.forEach(singleObject => beatmapHitObjects.push(Number(singleObject.time)));

            const hitTiming = parseInt(beatmapHitObjects[generalCount - 1]) - parseInt(beatmapHitObjects[0]);
            const hitPoint = parseInt(beatmapHitObjects[totalHits - 1]) - parseInt(beatmapHitObjects[0]);

            mapCompletion = (hitPoint / hitTiming) * 100;
        }

        return {
            convertedStars: stars.total,
            mapCompletion: (recent.rank === "F") ? mapCompletion : 100,
            recentPP: recentPP,
            fcPP: fcPP
        }
    }
}