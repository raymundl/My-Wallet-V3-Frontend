angular
  .module('walletApp')
  .controller('WalletCtrl', WalletCtrl);

function WalletCtrl ($scope, $rootScope, Wallet, $uibModal, $timeout, Alerts, $interval, $ocLazyLoad, $state, $uibModalStack, $q, MyWallet, currency, $translate, $window) {
  $scope.goal = Wallet.goal;

  $scope.status = Wallet.status;
  $scope.settings = Wallet.settings;
  $rootScope.isMock = Wallet.isMock;
  $rootScope.needsRefresh = false;

  $scope.menu = {
    isCollapsed: false
  };

  $scope.toggleMenu = () => {
    $scope.menu.isCollapsed = !$scope.menu.isCollapsed;
  };

  $scope.hideMenu = () => {
    $scope.menu.isCollapsed = false;
  };

  $scope.lastAction = Date.now();
  $scope.onAction = () => $scope.lastAction = Date.now();
  $scope.getTheme = () => $scope.settings.theme.class;

  $scope.inactivityCheck = () => {
    if (!Wallet.status.isLoggedIn) return;
    let inactivityTimeSeconds = Math.round((Date.now() - $scope.lastAction) / 1000);
    let logoutTimeSeconds = Wallet.settings.logoutTimeMinutes * 60;
    if (inactivityTimeSeconds === logoutTimeSeconds - 10) {
      let logoutTimer = $timeout(() => Wallet.logout({ auto: true }), 10000);
      let alertOpts = { values: { minutes: Wallet.settings.logoutTimeMinutes }, action: 'LOG_ME_OUT' };
      Alerts.confirm('CONFIRM_AUTO_LOGOUT', alertOpts)
        .then(Wallet.logout).catch(() => $timeout.cancel(logoutTimer));
    }
  };

  $scope.inactivityInterval = $interval($scope.inactivityCheck, 1000);
  $scope.$on('$destroy', () => $interval.cancel($scope.inactivityInterval));

  $rootScope.browserWithCamera = (navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia) !== void 0;

  $scope.request = () => {
    Alerts.clear();
    $uibModal.open({
      templateUrl: 'partials/request.jade',
      windowClass: 'bc-modal auto',
      controller: 'RequestCtrl',
      resolve: {
        destination: () => null,
        focus: () => false
      }
    });
  };

  $scope.send = () => {
    Alerts.clear();
    $uibModal.open({
      templateUrl: 'partials/send.jade',
      windowClass: 'bc-modal initial',
      controller: 'SendCtrl',
      resolve: {
        paymentRequest: () => ({
          address: '',
          amount: ''
        }),
        loadBcQrReader: () => {
          return $ocLazyLoad.load('bcQrReader');
        }
      }
    });
  };

  $scope.$on('requireSecondPassword', (notification, defer, insist) => {
    const modalInstance = $uibModal.open({
      templateUrl: 'partials/second-password.jade',
      controller: 'SecondPasswordCtrl',
      backdrop: insist ? 'static' : null,
      keyboard: insist,
      windowClass: 'bc-modal',
      resolve: {
        insist: () => insist,
        defer: () => defer
      }
    });
    modalInstance.result.then(() => {}, () => defer.reject());
  });

  $scope.isPublicState = (stateName) => (
    stateName.split('.')[0] === 'public' ||
    ['landing', 'open', 'wallet.common.unsubscribe'].indexOf(stateName) > -1
  );

  $scope.$on('$stateChangeStart', (event, toState, toParams, fromState, fromParams) => {
    let wallet = MyWallet.wallet;
    if ($scope.isPublicState(toState.name) && Wallet.status.isLoggedIn) {
      event.preventDefault();
    }
    if (wallet && wallet.isDoubleEncrypted && toState.name === 'wallet.common.buy-sell') {
      event.preventDefault();
      Alerts.displayError('MUST_DISABLE_2ND_PW');
    } else if (wallet && $rootScope.needsRefresh && toState.name === 'wallet.common.buy-sell') {
      event.preventDefault();
      Alerts.displayError('NEEDS_REFRESH');
    }
  });

  $scope.$on('$stateChangeSuccess', (event, toState, toParams, fromState, fromParams) => {
    if (!$scope.isPublicState(toState.name) && !$scope.status.isLoggedIn) {
      $state.go('public.login-no-uid');
    }
    $rootScope.outOfApp = toState.name === 'landing';
    $uibModalStack.dismissAll();
  });

  $rootScope.scheduleRefresh = () => {
    $scope.cancelRefresh();
    $scope.refreshTimeout = $timeout($scope.refresh, 3000);
  };

  $rootScope.cancelRefresh = () => {
    $timeout.cancel($scope.refreshTimeout);
  };

  $scope.refresh = () => {
    $scope.refreshing = true;
    $q.all([ MyWallet.wallet.getHistory(), currency.fetchExchangeRate() ])
      .catch(() => console.log('error refreshing'))
      .finally(() => {
        $scope.$broadcast('refresh');
        $timeout(() => $scope.refreshing = false, 500);
      });
  };

  $scope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error) => {
    let message = typeof error === 'string' ? error : 'ROUTE_ERROR';
    Alerts.displayError(message);
  });

  $scope.$watch('status.isLoggedIn + goal', () => $timeout($scope.checkGoals));

  $scope.checkGoals = () => {
    if ($scope.status.isLoggedIn) {
      if (Wallet.goal.upgrade) {
        $uibModal.open({
          templateUrl: 'partials/upgrade.jade',
          controller: 'UpgradeCtrl',
          backdrop: 'static',
          windowClass: 'bc-modal',
          keyboard: false
        });
        Wallet.goal.upgrade = void 0;
      }
      if (Wallet.goal.auth) {
        Alerts.clear();
        $translate(['AUTHORIZED', 'AUTHORIZED_MESSAGE']).then(translations => {
          $scope.$emit('showNotification', {
            type: 'authorization-verified',
            icon: 'ti-check',
            heading: translations.AUTHORIZED,
            msg: translations.AUTHORIZED_MESSAGE
          });
        });
        Wallet.goal.auth = void 0;
      }
      if (Wallet.goal.firstTime) {
        $uibModal.open({
          templateUrl: 'partials/first-login-modal.jade',
          windowClass: 'bc-modal rocket-modal initial'
        });
        Wallet.goal.firstLogin = true;
        Wallet.goal.firstTime = void 0;
      }
      if (Wallet.status.didLoadTransactions && Wallet.status.didLoadBalances) {
        if (Wallet.goal.send != null) {
          $uibModal.open({
            templateUrl: 'partials/send.jade',
            controller: 'SendCtrl',
            resolve: {
              paymentRequest: () => Wallet.goal.send,
              loadBcQrReader: () => $ocLazyLoad.load('bcQrReader')
            },
            windowClass: 'bc-modal initial'
          });
          Wallet.goal.send = void 0;
        }
      } else {
        $timeout($scope.checkGoals, 100);
      }
    }
  };

  $scope.back = () => $window.history.back();
}
