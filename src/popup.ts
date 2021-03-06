import { parseQueryString, getFullUrlPath } from './utils';

export interface IPopup {
  open(url: string, name: string, popupOptions: { width: number, height: number }, redirectUri: string): void;
  stringifyOptions (options: any): string;
  polling(redirectUri: string): angular.IPromise<any>;
  chromePolling(redirectUri: string): angular.IPromise<any>;
  eventListener(redirectUri: string): angular.IPromise<any>;
}

export default class Popup implements IPopup {
  static $inject = ['$interval', '$window', '$q'];

  public popup: any;
  public chromePopup: any;
  private url: string;
  private defaults: { redirectUri: string };

  constructor(private $interval: angular.IIntervalService,
              private $window: angular.IWindowService,
              private $q: angular.IQService) {
    this.popup = null;
    this.defaults = {
      redirectUri: null
    };
  }

  stringifyOptions (options: any): string {
    const parts = [];
    angular.forEach(options, function (value, key) {
      parts.push(key + '=' + value);
    });
    return parts.join(',');
  }

  open(url: string,
       name: string,
       popupOptions: { width: number, height: number },
       redirectUri: string,
       dontPoll?: boolean): angular.IPromise<any> {
    const width = popupOptions.width || 500;
    const height = popupOptions.height || 500;

    const options = this.stringifyOptions({
      width: width,
      height: height,
      top: this.$window.screenY + ((this.$window.outerHeight - height) / 2.5),
      left: this.$window.screenX + ((this.$window.outerWidth - width) / 2)
    });

    if (typeof(chrome) != 'undefined' && chrome.windows && chrome.windows.create) {
      // make a native chrome window
      const chromeWindowCreateOpts = {
        'url': url,
        'width': width,
        'height': height,
        'type': 'panel'
      }
      return this.$q((resolve, reject) => {
        chrome.windows.create(chromeWindowCreateOpts, (win) => {
          // force to top, bounce
          if (win) {
            chrome.windows.update(win.id, {
              'drawAttention': true,
              'focused': true
            })
            this.chromePopup = win
            this.chromePopup.location = new URL(url)
            resolve(this.chromePolling(redirectUri))
          }
        })
      })
    } else {
      const popupName = this.$window['cordova'] || this.$window.navigator.userAgent.indexOf('CriOS') > -1 ? '_blank' : name;
      this.popup = this.$window.open(url, popupName, options);
      if (this.popup && this.popup.focus) {
          this.popup.focus();
      }
      if (dontPoll) {
          return;
      }
      if (this.$window['cordova']) {
          return this.eventListener(redirectUri);
      }
      else {
          if (url === 'about:blank') {
              this.popup.location = url;
          }
      }

      return this.polling(redirectUri);
    }
  }

  polling(redirectUri: string): angular.IPromise<any> {
    return this.$q((resolve, reject) => {
      const redirectUriParser = document.createElement('a');
      redirectUriParser.href = redirectUri;
      const redirectUriPath = getFullUrlPath(redirectUriParser);

      const polling = this.$interval(() => {
        if (!this.popup || this.popup.closed || this.popup.closed === undefined) {
          this.$interval.cancel(polling);
          reject(new Error('The popup window was closed'));
        }

        try {
          const popupWindowPath = getFullUrlPath(this.popup.location);

          if (popupWindowPath === redirectUriPath) {
            if (this.popup.location.search || this.popup.location.hash) {
              const query = parseQueryString(this.popup.location.search.substring(1).replace(/\/$/, ''));
              const hash = parseQueryString(this.popup.location.hash.substring(1).replace(/[\/$]/, ''));
              const params = angular.extend({}, query, hash);

              if (params.error) {
                reject(new Error(params.error));
              } else {
                resolve(params);
              }
            } else {
              reject(new Error(
                'OAuth redirect has occurred but no query or hash parameters were found. ' +
                'They were either not set during the redirect, or were removed—typically by a ' +
                'routing library—before Satellizer could read it.'
              ));
            }

            this.$interval.cancel(polling);
            this.popup.close();
          }
        } catch (error) {
          // Ignore DOMException: Blocked a frame with origin from accessing a cross-origin frame.
          // A hack to get around same-origin security policy errors in IE.
        }
      }, 500);
    });
  }

  chromePolling(redirectUri: string): angular.IPromise<any> {
    let lastFocus = new Date()
    return this.$q((resolve, reject) => {
      const redirectUriParser = document.createElement('a');
      redirectUriParser.href = redirectUri;
      const redirectUriPath = getFullUrlPath(redirectUriParser);

      const polling = this.$interval(() => {
        if (!this.chromePopup) {
          this.$interval.cancel(polling);
          reject(new Error('The popup window was closed'));
        }

        try {
          chrome.windows.get(this.chromePopup.id, {'populate': true}, (winInfo) => {
            if (! winInfo) {
              // closed popup
              this.$interval.cancel(polling);
              return reject(new Error('The popup window was closed'))
            }

            // keep focused every 6 seconds
            if (lastFocus.getTime() < new Date().getTime() - 6*1000) {
              chrome.windows.update(this.chromePopup.id, {
                'focused': true,
                'drawAttention': true
              })
              lastFocus = new Date()
            }

            const tabUrl = new URL(winInfo.tabs[0].url)
            const popupWindowPath = getFullUrlPath(tabUrl);

            if (popupWindowPath === redirectUriPath) {
              if (tabUrl.search || tabUrl.hash) {
                const query = parseQueryString(tabUrl.search.substring(1).replace(/\/$/, ''));
                const hash = parseQueryString(tabUrl.hash.substring(1).replace(/[\/$]/, ''));
                const params = angular.extend({}, query, hash);

                if (params.error) {
                  reject(new Error(params.error));
                } else {
                  resolve(params);
                }
              } else {
                reject(new Error(
                  'OAuth redirect has occurred but no query or hash parameters were found. ' +
                  'They were either not set during the redirect, or were removed—typically by a ' +
                  'routing library—before Satellizer could read it.'
                ));
              }

              this.$interval.cancel(polling);
              chrome.windows.remove(this.chromePopup.id);
            }
          })
        } catch (error) {
          // Ignore DOMException: Blocked a frame with origin from accessing a cross-origin frame.
          // A hack to get around same-origin security policy errors in IE.
          console.log(error)
        }
      }, 500);
    });
  }

  eventListener(redirectUri): angular.IPromise<any> {
    return this.$q((resolve, reject) => {
      this.popup.addEventListener('loadstart', (event) => {
        if (event.url.indexOf(redirectUri) !== 0) {
          return;
        }

        const parser = document.createElement('a');
        parser.href = event.url;

        if (parser.search || parser.hash) {
          const query = parseQueryString(parser.search.substring(1).replace(/\/$/, ''));
          const hash = parseQueryString(parser.hash.substring(1).replace(/[\/$]/, ''));
          const params = angular.extend({}, query, hash);

          if (params.error) {
            reject(new Error(params.error));
          } else {
            resolve(params);
          }

          this.popup.close();
        }
      });

      this.popup.addEventListener('loaderror', () => {
        reject(new Error('Authorization failed'));
      });

      this.popup.addEventListener('exit', () => {
        reject(new Error('The popup window was closed'));
      });
    });
  }
}
