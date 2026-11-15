import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_storekit/store_kit_2_wrappers.dart';

import 'api.dart';

/// Waypack Pro bought in the iPhone app (DECISIONS #72). StoreKit 2 does the purchase with the
/// Waypack user id as `appAccountToken`; every transaction StoreKit delivers (a purchase, a
/// restore, or one left unfinished last time) goes to the Worker as its signed JWS, which checks
/// Apple's signature before the plan changes, and is finished only once the Worker has it. Renewals,
/// expiries and refunds reach the Worker straight from Apple (App Store Server Notifications).
class ProStore extends ChangeNotifier {
  ProStore({required this.api, required this.onPlan});

  static const annualId = 'com.hejitech.waypack.pro.annual';
  static const lifetimeId = 'com.hejitech.waypack.pro.lifetime';

  final Api api;

  /// Called with the Worker's answer (`plan`, `plan_source`, `expires_at`) after it took a purchase.
  final void Function(Map<String, dynamic> plan) onPlan;

  /// Only the iPhone app sells Pro: the Mac app is a DMG (no App Store), Android isn't on Play yet.
  static bool get supported => !kIsWeb && Platform.isIOS;

  final Map<String, ProductDetails> products = {};
  bool available = false;
  bool introEligible = false;
  bool loading = false;

  /// The product being bought, or 'restore'; null when idle.
  String? busy;
  String? error;

  /// Set when a purchase or restore went through and the plan is now Pro.
  bool justUnlocked = false;

  StreamSubscription<List<PurchaseDetails>>? _sub;

  /// Starts listening (once, at launch: StoreKit re-delivers unfinished transactions then).
  void start() {
    if (!supported || _sub != null) return;
    _sub = InAppPurchase.instance.purchaseStream.listen(
      _onPurchases,
      onError: (Object e) {
        error = '$e';
        busy = null;
        notifyListeners();
      },
    );
  }

  Future<void> loadProducts() async {
    if (!supported || loading) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      available = await InAppPurchase.instance.isAvailable();
      if (available) {
        final r = await InAppPurchase.instance.queryProductDetails({
          annualId,
          lifetimeId,
        });
        products
          ..clear()
          ..addEntries(r.productDetails.map((p) => MapEntry(p.id, p)));
        if (r.notFoundIDs.isNotEmpty && products.isEmpty) {
          error = 'Waypack Pro isn\'t available in the App Store right now.';
        }
        if (products.containsKey(annualId)) {
          introEligible = await SK2Product.isIntroductoryOfferEligible(annualId)
              .catchError((_) => false);
        }
      } else {
        error = 'The App Store isn\'t available on this device.';
      }
    } catch (e) {
      error = '$e';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> buy(String productId, {required String userId}) async {
    final p = products[productId];
    if (p == null || busy != null) return;
    busy = productId;
    error = null;
    justUnlocked = false;
    notifyListeners();
    try {
      // Both are bought the same way in StoreKit 2; the annual one renews on its own.
      await InAppPurchase.instance.buyNonConsumable(
        purchaseParam: PurchaseParam(
          productDetails: p,
          applicationUserName: userId,
        ),
      );
    } catch (e) {
      busy = null;
      error = '$e';
      notifyListeners();
    }
  }

  Future<void> restore() async {
    if (busy != null) return;
    busy = 'restore';
    error = null;
    justUnlocked = false;
    notifyListeners();
    try {
      await InAppPurchase.instance.restorePurchases();
      // Nothing to restore delivers nothing: stop the spinner after a moment.
      Future<void>.delayed(const Duration(seconds: 4), () {
        if (busy == 'restore') {
          busy = null;
          notifyListeners();
        }
      });
    } catch (e) {
      busy = null;
      error = '$e';
      notifyListeners();
    }
  }

  Future<void> _onPurchases(List<PurchaseDetails> list) async {
    final signed = <String>[];
    final done = <PurchaseDetails>[];
    for (final p in list) {
      switch (p.status) {
        case PurchaseStatus.pending:
          continue; // Ask to Buy etc.: wait for the next update
        case PurchaseStatus.canceled:
          busy = null;
        case PurchaseStatus.error:
          busy = null;
          error = p.error?.message ?? 'The purchase didn\'t go through.';
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          if (p.verificationData.serverVerificationData.isNotEmpty) {
            signed.add(p.verificationData.serverVerificationData);
          }
      }
      done.add(p);
    }
    if (signed.isNotEmpty) {
      try {
        final r = await api.appStoreTransactions(signed);
        onPlan(r);
        final tier = (r['plan'] as Map?)?['tier'];
        justUnlocked = tier != null && tier != 'free';
        if (!justUnlocked && busy != null) {
          error =
              'The App Store didn\'t report an active Waypack Pro purchase.';
        }
      } catch (e) {
        // Leave them unfinished: StoreKit delivers them again at the next launch.
        error =
            'Couldn\'t confirm the purchase with Waypack: $e. It will be retried.';
        busy = null;
        notifyListeners();
        return;
      }
      busy = null;
    }
    for (final p in done) {
      if (p.pendingCompletePurchase) {
        await InAppPurchase.instance.completePurchase(p);
      }
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
