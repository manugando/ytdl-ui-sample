const $ = require('jquery');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg   = require('fluent-ffmpeg');
const { dialog, getCurrentWindow, shell } = require('electron').remote;

const userChoices = require('./user-choices');

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

function startDownload() {
    showLoadingOverlay(true, 'Downloading...');
    let stream = ytdl.downloadFromInfo(userChoices.videoInfo, { format: userChoices.getVideoFormat() });
    stream
        .on('progress', (chunkLength, downloaded, total) => {
            onDownloadProgress(downloaded, total);
        })
        .on('error', () => {
            showErrorOverlay();
        })
        .on('end', () => {
            if(userChoices.outputFileForceMp3) {
                showLoadingOverlay(true, 'Converting to mp3...');
                convertToMp3();
            } else {
                onDownloadCompleted();
            }
        })
        .pipe(fs.createWriteStream(userChoices.getOutputFile()))
}

function convertToMp3() {
    ffmpeg(userChoices.getOutputFile())
        .audioBitrate(320)
        .save(userChoices.getOutputFileMp3())
        .on('error', () => {
            showErrorOverlay();
        })
        .on('end', () => {
            fs.unlinkSync(userChoices.getOutputFile());
            onDownloadCompleted();
        });
}

function onDownloadProgress(downloaded, total) {
    let progress = downloaded / total;
    let percent = (progress * 100).toFixed(0);
    showLoadingOverlay(true, 'Download in progress: ' + percent + '%');
    getCurrentWindow().setProgressBar(progress);
}

function onDownloadCompleted() {
    showLoadingOverlay(false);
    getCurrentWindow().setProgressBar(-1);
    let notification = new Notification('Download finished!', { body: userChoices.getVideoTitle() });
    notification.onclick = () => {
        shell.openItem(userChoices.outputFileForceMp3 ? userChoices.getOutputFileMp3() : userChoices.getOutputFile());
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
function showErrorOverlay(message = 'An error has occurred') {
    $('#error-overlay').removeClass('d-none');
    $('#error-overlay-message').text(message);
}

/* Section Choose Video */

function initSectionChooseVideo() {
    $('#choose-video-button-submit-video-url').click(() => {
        let videoUrl = $('#choose-video-field-video-url').val();
        showLoadingOverlay(true, 'Retrieving video info...');
        ytdl.getInfo(videoUrl)
            .then((videoInfo) => {
                userChoices.videoInfo = videoInfo;
                populateSectionVideoDetail();
                showSection('video-detail');
                showLoadingOverlay(false);
            })
            .catch((reason) => {
                showErrorOverlay('Wrong URL format');
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
    $('#video-detail-title').text(userChoices.getVideoTitle());
    $('#video-detail-author').text(userChoices.getVideoAuthor());
    $('#video-detail-thumb').attr('src', userChoices.getVideoThumb());
    userChoices.videoInfo.formats.forEach((format) => {
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
    $('#output-detail-browse').click(() => {
        let outputPath = dialog.showOpenDialog({ properties: ['openDirectory'] });
        $('#output-detail-path').val(outputPath);
    });

    $('#output-detail-button-download').click(() => {
        userChoices.outputFileName = $('#output-detail-name').val();
        userChoices.outputFileForceMp3 = $('#output-detail-force-mp3').val() == true;
        userChoices.outputFilePath = $('#output-detail-path').val();

        if(userChoices.validate()) {
            startDownload();
        } else {
            window.alert('Some info are missing!');
        }
    });
}

function populateSectionOutputDetail() {
    let cleanTitle = userChoices.getVideoTitle()
        .replace(/[^a-zA-Z0-9 ]/g, '') // Removes dangerous characters
        .replace(/\s\s+/g, ' '); // Removes multiple spaces
    let extension = userChoices.getVideoFormat().container;
    $('#output-detail-name').val(cleanTitle + '.' + extension);
}