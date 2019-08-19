const $ = require('jquery');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg   = require('fluent-ffmpeg');
const { dialog, getCurrentWindow, shell } = require('electron').remote;

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
    outputFileForceMp3: null
}

$(() => {
    initApp();
    initSectionChooseVideo();
    initSectionVideoDetail();
    initSectionOutputDetail();
});

/* Common stuff */

function initApp() {
    $('#button-reload-app, #button-retry').click(() => {
        getCurrentWindow().reload();
    });
}

/**
 * @param {String} sectionId
 */
function showSection(sectionId) {
    $('section').addClass('d-none');
    $('#' + sectionId).removeClass('d-none');
}

/**
 * @return {boolean}
 */
function validateUserChoices() {
    return userChoices.videoInfo != null &&
        userChoices.videoFormatIndex != null &&
        userChoices.outputFileName != '' &&
        userChoices.outputFileForceMp3 != null &&
        userChoices.outputFilePath != '';
}

/**
 * @return {ytdl.videoFormat}
 */
function getUserChoiceVideoFormat() {
    return userChoices.videoInfo.formats[userChoices.videoFormatIndex];
}

/**
 * @return {String}
 */
function getUserChoiceVideoTitle() {
    try {
        return userChoices.videoInfo.player_response.videoDetails.title;
    } catch (error) {
        return 'Video';
    }
}

/**
 * @return {String}
 */
function getUserChoiceOutputFile() {
    return path.join(userChoices.outputFilePath, userChoices.outputFileName);
}

function startDownload() {
    showLoadingOverlay(true, 'Download in corso...');
    let filePath = getUserChoiceOutputFile();
    let stream = ytdl.downloadFromInfo(userChoices.videoInfo, { format: getUserChoiceVideoFormat() });
    if(userChoices.outputFileForceMp3) {
        ffmpeg(stream)
            .audioBitrate(256)
            .save(filePath)
            .on('end', () => {
                onDownloadCompleted();
            });
    } else {
        stream
            .on('progress', (chunkLength, downloaded, total) => {
                onDownloadProgress(downloaded, total);
            })
            .on('error', () => {
                showErrorOverlay();
            })
            .on('end', () => {
                onDownloadCompleted();
            })
            .pipe(fs.createWriteStream(filePath))
    }
        
}

function onDownloadProgress(downloaded, total) {
    let progress = downloaded / total;
    let percent = (progress * 100).toFixed(0);
    showLoadingOverlay(true, 'Download in corso: ' + percent + '%');
    getCurrentWindow().setProgressBar(progress);
}

function onDownloadCompleted() {
    showLoadingOverlay(false);
    getCurrentWindow().setProgressBar(-1);
    let notification = new Notification('Download terminato!', { body: userChoices.outputFileName,  });
    notification.onclick = () => {
        shell.openItem(getUserChoiceOutputFile());
    }
}

/**
 * @param {boolean} show
 * @param {String} message
 */
function showLoadingOverlay(show, message = null) {
    $('#loading-overlay').toggleClass('d-none', !show);
    if(show) {
        $('#loading-overlay-message').text(message);
    }
}

/**
 * @param {String} message
 */
function showErrorOverlay(message = 'Si è verificato un errore') {
    $('#error-overlay').removeClass('d-none');
    $('#error-overlay-message').text(message);
}

/* Section Choose Video */

function initSectionChooseVideo() {
    $('#choose-video-button-submit-video-url').click(() => {
        let videoUrl = $('#choose-video-field-video-url').val();
        showLoadingOverlay(true, 'Recupero info del video...');
        ytdl.getInfo(videoUrl)
            .then((videoInfo) => {
                userChoices.videoInfo = videoInfo;
                populateSectionVideoDetail();
                showSection('video-detail');
                showLoadingOverlay(false);
            })
            .catch((reason) => {
                showErrorOverlay('Formato URL non corretto');
            });
    });
}

/* Section Video Detail */

function initSectionVideoDetail() {
    $('#video-detail-formats').on('click', '.list-group-item', (event) => {
        userChoices.videoFormatIndex = $(event.currentTarget).index();
        populateSectionOutputDetail();
        showSection('output-detail');
    });
}

function populateSectionVideoDetail() {
    let videoInfo = userChoices.videoInfo;
    $('#video-detail-title').text(getUserChoiceVideoTitle());
    $('#video-detail-author').text(videoInfo.author.name);
    $('#video-detail-thumb').attr('src', videoInfo.player_response.videoDetails.thumbnail.thumbnails[0].url);
    videoInfo.formats.forEach((format) => {
        let item = getSectionVideoDetailFormatsItem(format);
        $('#video-detail-formats').append(item);
    });
}

/**
 * @param {ytdl.videoFormat} videoFormat
 */
function getSectionVideoDetailFormatsItem(videoFormat) {
    let item = $('<li>').addClass('list-group-item');

    let hasVideo = videoFormat.bitrate;
    let hasAudio = videoFormat.audioBitrate;

    item.append($('<span></span>').text(videoFormat.container));

    if(hasVideo) {
        item.append($('<i></i>').addClass('fas fa-film'));
        item.append($('<span></span>').text(videoFormat.resolution));
        item.append($('<span></span>').text(videoFormat.encoding));
    }

    if(hasAudio) {
        item.append($('<i></i>').addClass('fas fa-volume-up'));
        item.append($('<span></span>').text(videoFormat.audioBitrate));
        item.append($('<span></span>').text(videoFormat.audioEncoding));
    }

    return item;
}

/* Section Output Detail */

function initSectionOutputDetail() {
    $('#output-detail-force-mp3').change(() => {
        let isForceMp3 = $(this).val() == true;
        let nameWithoutExt = path.parse($('#output-detail-name').val()).name;
        let newName = nameWithoutExt + '.' + (isForceMp3 ? 'mp3' : getUserChoiceVideoFormat().container);
        $('#output-detail-name').val(newName);
    });

    $('#output-detail-browse').click(() => {
        let outputPath = dialog.showOpenDialog({ properties: ['openDirectory'] });
        $('#output-detail-path').val(outputPath);
    });

    $('#output-detail-button-download').click(() => {
        userChoices.outputFileName = $('#output-detail-name').val();
        userChoices.outputFileForceMp3 = $('#output-detail-force-mp3').val() == true;
        userChoices.outputFilePath = $('#output-detail-path').val();

        if(validateUserChoices()) {
            startDownload();
        } else {
            window.alert('Mancano dei dati!');
        }
    });
}

function populateSectionOutputDetail() {
    let cleanTitle = getUserChoiceVideoTitle().replace(/[^a-zA-Z0-9 ]/g, '');
    let extension = getUserChoiceVideoFormat().container;
    $('#output-detail-name').val(cleanTitle + '.' + extension);
}