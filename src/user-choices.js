const path = require('path');
const ytdl = require('ytdl-core');

let userChoices = {
    /**
     * @type {ytdl.videoInfo}
     */
    videoInfo: null,

    /**
     * @type {Number}
     */
    videoFormatIndex: null,

    /**
     * @type {String}
     */
    outputFileName: null,

    /**
     * @type {String}
     */
    outputFilePath: null,

    /**
     * @type {boolean}
     */
    outputFileForceMp3: null,

    /**
     * @return {boolean}
     */
    validate: () => {
        return userChoices.videoInfo != null &&
            userChoices.videoFormatIndex != null &&
            userChoices.outputFileName != '' &&
            userChoices.outputFileForceMp3 != null &&
            userChoices.outputFilePath != '';
    },

    /**
     * @return {ytdl.videoFormat}
     */
    getVideoFormat: () => { 
        return userChoices.videoInfo.formats[userChoices.videoFormatIndex]; 
    },

    /**
     * @return {String}
     */
    getVideoTitle: () => {
        try {
            return userChoices.videoInfo.player_response.videoDetails.title;
        } catch (error) {
            return 'Video';
        }
    },

    /**
     * @return {String}
     */
    getVideoThumb: () => {
        try {
            return userChoices.videoInfo.player_response.videoDetails.thumbnail.thumbnails[0].url;
        } catch (error) {
            return '';
        }
    },

    /**
     * @return {String}
     */
    getVideoAuthor: () => {
        try {
            return userChoices.videoInfo.author.name;
        } catch (error) {
            return '';
        }
    },

    /**
     * @return {String}
     */
    getOutputFile: () => {
        return path.join(userChoices.outputFilePath, userChoices.outputFileName);
    }
}

module.exports = userChoices;