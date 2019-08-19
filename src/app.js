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
    showLoadingOverlay(true, 'Download in corso...');
    let filePath = userChoices.getOutputFile();
    let stream = ytdl.downloadFromInfo(userChoices.videoInfo, { format: userChoices.getVideoFormat() });
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
        shell.openItem(userChoices.getOutputFile());
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
    $('#output-detail-force-mp3').change(() => {
        let isForceMp3 = $(this).val() == true;
        let nameWithoutExt = path.parse($('#output-detail-name').val()).name;
        let newName = nameWithoutExt + '.' + (isForceMp3 ? 'mp3' : userChoices.getVideoFormat().container);
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

        if(userChoices.validate()) {
            startDownload();
        } else {
            window.alert('Mancano dei dati!');
        }
    });
}

function populateSectionOutputDetail() {
    let cleanTitle = userChoices.getVideoTitle().replace(/[^a-zA-Z0-9 ]/g, '');
    let extension = userChoices.getVideoFormat().container;
    $('#output-detail-name').val(cleanTitle + '.' + extension);
}