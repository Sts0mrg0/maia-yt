import { ServicePort } from '../../libs/messaging/ServicePort';
import { Component } from '../../libs/Component';
import { PlayerApi, PlayerState, PlaybackQuality } from './PlayerApi';
import { PlayerListenable, PlayerEvent } from './PlayerListenable';
import { EventType } from './EventType';

declare interface PlayerApiElement extends Element {
  getApiInterface: () => string[];
}

declare interface VolumeChangeDetail {
  muted: boolean;
  volume: number;
}

declare interface FullscreenChangeDetail {
  fullscreen: number;
  time: number;
  videoId: string;
}

export class Player extends Component {
  private _id: string;
  private _element: Element;
  private _port: ServicePort;

  private _api: PlayerApi;

  private _originalAddEventListener: Function;
  private _originalRemoveEventListener: Function;
  private _youtubeEvents: {[key: string]: Function} = {};
  private _preventDefaultEvents: {[key: string]: boolean} = {};

  private _playerListenable: PlayerListenable;

  constructor(id: string, element: Element, port: ServicePort) {
    super();
    this._id = id;
    this._element = element;
    this._port = port;

    this._originalAddEventListener = (this._element as any)["addEventListener"];
    this._originalRemoveEventListener = (this._element as any)["removeEventListener"];

    (this._element as any)["addEventListener"] = (type: string, fn: Function|string) => this._addEventListener(type, fn);
    (this._element as any)["removeEventListener"] = (type: string, fn: Function|string) => this._removeEventListener(type, fn);
  }
  
  protected disposeInternal() {
    super.disposeInternal();

    (this._element as any)["addEventListener"] = this._originalAddEventListener;
    (this._element as any)["removeEventListener"] = this._originalRemoveEventListener;

    if (this._playerListenable) {
      this._playerListenable.dispose();
    }

    delete this._playerListenable;
    delete this._originalAddEventListener;
    delete this._originalRemoveEventListener;
    delete this._element;
    delete this._api;
    delete this._port;
  }
  
  private _addEventListener(type: string, fn: Function|string): void {
    this.getPlayerListenable().ytAddEventListener(type, fn, this._originalAddEventListener.bind(this._element));
  }
  
  private _removeEventListener(type: string, fn: Function|string): void {
    this.getPlayerListenable().ytRemoveEventListener(type, fn, this._originalRemoveEventListener.bind(this._element));
  }

  public getPlayerListenable(): PlayerListenable {
    if (!this._playerListenable) {
      this._playerListenable = new PlayerListenable(this.getApi());
    }
    return this._playerListenable;
  }

  enterDocument() {
    super.enterDocument();

    let player = this.getPlayerListenable();

    this.getHandler()
      .listen(player, "onReady", this._handleOnReady, false)
      .listen(player, "onStateChange", this._handleStateChange, false)
      .listen(player, "onVolumeChange", this._handleVolumeChange, false)
      .listen(player, "onFullscreenChange", this._handleFullscreenChange, false)
      .listen(player, "onPlaybackQualityChange", this._handlePlaybackQualityChange, false)
      .listen(player, "onPlaybackRateChange", this._handlePlaybackRateChange, false)
      .listen(player, "onApiChange", this._handleApiChange, false)
      .listen(player, "onError", this._handleError, false)
      .listen(player, "onDetailedError", this._handleDetailedError, false)
      .listen(player, "SIZE_CLICKED", this._handleSizeClicked, false)
      .listen(player, "onAdStateChange", this._handleAdStateChange, false)
      .listen(player, "onSharePanelOpened", this._handleSharePanelOpened, false)
      .listen(player, "onPlaybackAudioChange", this._handlePlaybackAudioChange, false)
      .listen(player, "onVideoDataChange", this._handleVideoDataChange, false)
      .listen(player, "onPlaylistUpdate", this._handlePlaylistUpdate, false)
      .listen(player, "onCueRangeEnter", this._handleCueRangeEnter, false)
      .listen(player, "onCueRangeExit", this._handleCueRangeExit, false)
      .listen(player, "onCueRangeMarkersUpdated", this._handleCueRangeMarkersUpdated, false)
      .listen(player, "onCueRangesAdded", this._handleCueRangesAdded, false)
      .listen(player, "onCueRangesRemoved", this._handleCueRangesRemoved, false)
      .listen(player, "CONNECTION_ISSUE", this._handleConnectionIssue, false)
      .listen(player, "SHARE_CLICKED", this._handleShareClicked, false)
      .listen(player, "WATCH_LATER_VIDEO_ADDED", this._handleWatchLaterVideoAdded, false)
      .listen(player, "WATCH_LATER_VIDEO_REMOVED", this._handleWatchLaterVideoRemoved, false)
      .listen(player, "WATCH_LATER_ERROR", this._handleWatchLaterError, false)
      .listen(player, "onLoadProgress", this._handleLoadProgress, false)
      .listen(player, "onVideoProgress", this._handleVideoProgress, false)
      .listen(player, "onReloadRequired", this._handleReloadRequired, false)
      .listen(player, "onPlayVideo", console.log.bind(console, "onPlayVideo"), false)
      .listen(player, "onPlaylistNext", console.log.bind(console, "onPlaylistNext"), false)
      .listen(player, "onPlaylistPrevious", console.log.bind(console, "onPlaylistPrevious"), false);
  }

  exitDocument() {
    super.exitDocument();
  }

  getId(): string {
    return this._id;
  }

  getApi(): PlayerApi {
    if (!this._api) {
      let player = this._element as PlayerApiElement;

      // Determine whether the API interface is on the element.
      if (typeof player.getApiInterface !== "function") {
        throw new Error("No API interface on player element.");
      }

      // List of all the available API methods.
      let apiList = player.getApiInterface();

      let api = {} as PlayerApi;

      // Populate the API object with the player API.
      for (let i = 0; i < apiList.length; i++) {
        let key = apiList[i];
        (api as any)[key] = (player as any)[key];
      }

      this._api = api;
    }

    return this._api;
  }

  private _fireEvent(e: PlayerEvent, type: EventType, ...args: any[]) {
    const preventDefault = this._port.callSync("player#event", this.getId(), type, ...args) as boolean;

    if (preventDefault) {
      e.preventDefault();
    }
  }
  
  private _handleOnReady(e: PlayerEvent) {
    this._fireEvent(e, EventType.READY);
  }

  private _handleStateChange(e: PlayerEvent) {
    let state = e.detail as PlayerState;

    let type: EventType;
    switch (state) {
      case -1:
        type = EventType.UNSTARTED;
        break;
      case 0:
        type = EventType.ENDED;
        break;
      case 1:
        type = EventType.PLAYED;
        break;
      case 2:
        type = EventType.PAUSED;
        break;
      case 3:
        type = EventType.BUFFERING;
        break;
      case 5:
        type = EventType.CUED;
        break;
      default:
        return;
    }
  
    this._fireEvent(e, type);
  }
  
  private _handleVolumeChange(e: PlayerEvent) {
    let detail = e.detail as VolumeChangeDetail;
    this._fireEvent(e, EventType.VOLUME_CHANGE, detail.volume, detail.muted);
  }
    
  private _handleFullscreenChange(e: PlayerEvent) {
    let detail = e.detail as FullscreenChangeDetail;
    this._fireEvent(e, EventType.FULLSCREEN_CHANGE, detail.fullscreen);
  }

  private _handlePlaybackQualityChange(e: PlayerEvent) {
    let quality = e.detail as PlaybackQuality;
    this._fireEvent(e, EventType.QUALITY_CHANGE, quality);
  }

  private _handlePlaybackRateChange(e: PlayerEvent) {
    let rate = e.detail as number;
    this._fireEvent(e, EventType.RATE_CHANGE, rate);
  }

  private _handleApiChange(e: PlayerEvent) {
    this._fireEvent(e, EventType.API_CHANGE);
  }

  private _handleError(e: PlayerEvent) {
    let errorCode = e.detail as number;
    this._fireEvent(e, EventType.ERROR, errorCode);
  }
  
  private _handleDetailedError(e: PlayerEvent) {
    
  }

  private _handleSizeClicked(e: PlayerEvent) {
    this._fireEvent(e, EventType.SIZE_CHANGE, e.detail as boolean);
  }
  
  private _handleAdStateChange(e: PlayerEvent) {
    let state = e.detail as PlayerState;
    
    let type: EventType;
    switch (state) {
      case -1:
        type = EventType.AD_UNSTARTED;
        break;
      case 0:
        type = EventType.AD_ENDED;
        break;
      case 1:
        type = EventType.AD_PLAYED;
        break;
      case 2:
        type = EventType.AD_PAUSED;
        break;
      case 3:
        type = EventType.AD_BUFFERING;
        break;
      case 5:
        type = EventType.AD_CUED;
        break;
      default:
        return;
    }
  
    this._fireEvent(e, type);
  }

  private _handleSharePanelOpened(e: PlayerEvent) {
    this._fireEvent(e, EventType.SHARE_PANEL_OPENED);
  }

  private _handlePlaybackAudioChange(e: PlayerEvent) {

  }

  private _handleVideoDataChange(e: PlayerEvent) {

  }
  
  private _handlePlaylistUpdate(e: PlayerEvent) {

  }
  
  private _handleCueRangeEnter(e: PlayerEvent) {
    
  }

  private _handleCueRangeExit(e: PlayerEvent) {

  }

  private _handleCueRangeMarkersUpdated(e: PlayerEvent) {

  }

  private _handleCueRangesAdded(e: PlayerEvent) {

  }

  private _handleCueRangesRemoved(e: PlayerEvent) {

  }

  private _handleConnectionIssue(e: PlayerEvent) {

  }

  private _handleShareClicked(e: PlayerEvent) {

  }

  private _handleWatchLaterVideoAdded(e: PlayerEvent) {

  }

  private _handleWatchLaterVideoRemoved(e: PlayerEvent) {

  }

  private _handleWatchLaterError(e: PlayerEvent) {

  }

  private _handleLoadProgress(e: PlayerEvent) {
    const progress = e.detail as number;
    this._fireEvent(e, EventType.LOAD_PROGRESS, progress);
  }

  private _handleVideoProgress(e: PlayerEvent) {
    const progress = e.detail as number;
    this._fireEvent(e, EventType.VIDEO_PROGRESS, progress);
  }

  private _handleReloadRequired(e: PlayerEvent) {
    this._fireEvent(e, EventType.RELOAD_REQUIRED);
  }

  private _handleEventPreventDefault(type: EventType) {
    this._preventDefaultEvents[type] = true;
  }
}