import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../services/handoff.dart';
import '../services/pro_store.dart';
import '../state/app_state.dart';
import 'scrapbook.dart';

/// Apple's standard licence agreement: Waypack has no custom EULA in App Store Connect.
const appleEulaUrl =
    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const appleSubscriptionsUrl = 'https://apps.apple.com/account/subscriptions';

/// The "Waypack Pro" sheet in the iPhone app ("Peek", reports/2026-11-16-pro-paywall-redesign): a
/// paper sheet over the app, which stays visible behind it, blurred. What Pro adds, the annual
/// subscription (with the free week when the person is eligible) and lifetime as selectable rows,
/// one button, Restore Purchases and the terms App Review asks for (guideline 3.1.2).
Future<void> showProSheet(BuildContext context) {
  final s = context.read<AppState>();
  s.pro.loadProducts();
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible:
        false, // the blurred layer below dismisses on tap instead
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (ctx, _, _) => const _PeekSheet(),
    transitionBuilder: (ctx, anim, _, child) {
      final t = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
      return Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(ctx).pop(),
              child: AnimatedBuilder(
                animation: t,
                builder: (_, _) => BackdropFilter(
                  filter: ui.ImageFilter.blur(
                    sigmaX: 7 * t.value,
                    sigmaY: 7 * t.value,
                  ),
                  child: ColoredBox(
                    color: const Color(0xFF281A0C)
                        .withValues(alpha: .28 * t.value),
                  ),
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).animate(t),
              child: child,
            ),
          ),
        ],
      );
    },
  );
}

/// The paper sheet itself (the same chrome as showPaperSheet), dragged down to close.
class _PeekSheet extends StatelessWidget {
  const _PeekSheet();

  @override
  Widget build(BuildContext context) {
    final p = Paper.of(context);
    return GestureDetector(
      onVerticalDragEnd: (d) {
        if ((d.primaryVelocity ?? 0) > 300) Navigator.of(context).pop();
      },
      child: Material(
        type: MaterialType.transparency,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .88,
            maxWidth: 640,
          ),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
            child: Kraft(
              child: SafeArea(
                top: false,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 38,
                          height: 5,
                          margin: const EdgeInsets.fromLTRB(0, 10, 0, 14),
                          decoration: BoxDecoration(
                            color: p.ink.withValues(alpha: .25),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                      const ProSheet(),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ProSheet extends StatefulWidget {
  const ProSheet({super.key});

  @override
  State<ProSheet> createState() => _ProSheetState();
}

class _ProSheetState extends State<ProSheet> {
  String _selected = ProStore.annualId;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return ListenableBuilder(
      listenable: s.pro,
      builder: (context, _) => _body(context, s, s.pro),
    );
  }

  Widget _body(BuildContext context, AppState s, ProStore pro) {
    final p = Paper.of(context);
    final tier = (s.me?['plan'] as Map?)?['tier'] as String? ?? 'free';
    final userId = s.user?.id;
    final annual = pro.products[ProStore.annualId];
    final lifetime = pro.products[ProStore.lifetimeId];
    final chosen = pro.products[_selected];
    final body = TextStyle(fontSize: 14, height: 1.45, color: p.ink);
    final small = TextStyle(fontSize: 12, height: 1.45, color: p.muted);

    Widget tile(IconData icon, String text) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: p.accent.withValues(alpha: .13),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: p.accent),
            const SizedBox(height: 6),
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: p.ink,
              ),
            ),
          ],
        ),
      ),
    );

    String perMonth(dynamic product) {
      try {
        return '${NumberFormat.simpleCurrency(name: product.currencyCode).format(product.rawPrice / 12)}/mo';
      } catch (_) {
        return '';
      }
    }

    Widget planRow(dynamic product, {required bool isAnnual}) {
      final on = _selected == product.id;
      return Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Material(
              color: on ? p.accent.withValues(alpha: .12) : p.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: on ? p.accent : p.line, width: 2),
              ),
              child: InkWell(
                key: Key(isAnnual ? 'buy-annual' : 'buy-lifetime'),
                borderRadius: BorderRadius.circular(16),
                onTap: () => setState(() => _selected = product.id),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
                  child: Row(
                    children: [
                      Icon(
                        on
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        color: on ? p.accent : p.muted,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isAnnual ? 'Yearly' : 'Lifetime',
                              style: body.copyWith(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              isAnnual
                                  ? (pro.introEligible
                                        ? '1 week free, then ${product.price}/year'
                                        : '${product.price} every year')
                                  : 'Pay once, keep it for good',
                              style: small,
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            isAnnual
                                ? '${product.price}/year'
                                : '${product.price} once',
                            style: body.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (isAnnual) Text(perMonth(product), style: small),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (isAnnual && pro.introEligible)
              Positioned(
                top: -9,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: p.accent,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: const Text(
                    '1 WEEK FREE',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: .4,
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    }

    String cta() {
      if (chosen == null) return '';
      if (pro.busy == chosen.id) return 'Opening the App Store…';
      if (chosen.id == ProStore.lifetimeId)
        return 'Unlock for life · ${chosen.price}';
      return pro.introEligible
          ? 'Try 1 week free'
          : 'Continue · ${chosen.price}/year';
    }

    String ctaNote() {
      if (chosen == null) return '';
      if (chosen.id == ProStore.lifetimeId)
        return 'One payment. Yours for good.';
      return pro.introEligible
          ? 'Then ${chosen.price} a year. Cancel anytime.'
          : 'Renews every year. Cancel anytime.';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.lock, size: 15, color: p.accent),
              const SizedBox(width: 6),
              Text(
                tier == 'free' ? 'UNLOCK ALL OF WAYPACK' : 'WAYPACK PRO',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .8,
                  color: p.accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Keep the trip working when the signal drops.',
            style: hand(34, p.ink),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              tile(Icons.map_outlined, 'Offline maps'),
              const SizedBox(width: 6),
              tile(Icons.luggage_outlined, '10 active trips'),
              const SizedBox(width: 6),
              tile(Icons.devices_outlined, 'iPhone, Mac, web'),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Offline maps for every trip, up to 4 map areas each, cut for you when a trip is published. '
            'Free: one active trip.',
            style: small,
          ),
          const SizedBox(height: 4),
          if (tier != 'free') ...[
            const SizedBox(height: 8),
            Text(
              tier == 'lifetime'
                  ? 'You have Waypack Pro for life. Thank you!'
                  : 'You have Waypack Pro. Thank you!',
              key: const Key('pro-active'),
              style: body.copyWith(fontWeight: FontWeight.w700),
            ),
          ] else if (pro.loading && pro.products.isEmpty) ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            ),
          ] else ...[
            if (annual != null) planRow(annual, isAnnual: true),
            if (lifetime != null) planRow(lifetime, isAnnual: false),
            if (chosen != null) ...[
              const SizedBox(height: 14),
              PaperButton(
                key: const Key('buy-pro'),
                expand: true,
                label: cta(),
                onPressed: userId == null || pro.busy != null
                    ? null
                    : () => pro.buy(chosen.id, userId: userId),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  ctaNote(),
                  style: small,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
            if (annual != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 10, 8, 0),
                child: Text(
                  '${pro.introEligible ? 'Free for 1 week, then ' : ''}${annual.price} a year, charged to your Apple Account. '
                  'Renews automatically unless you cancel at least 24 hours before the end of the current period; '
                  'manage or cancel it in your Apple Account settings.',
                  style: small.copyWith(fontSize: 11),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
          if (pro.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                pro.error!,
                style: small.copyWith(color: p.err),
                textAlign: TextAlign.center,
              ),
            ),
          const SizedBox(height: 4),
          Wrap(
            alignment: WrapAlignment.center,
            children: [
              TextButton(
                key: const Key('restore-purchases'),
                onPressed: pro.busy != null ? null : pro.restore,
                child: Text(
                  pro.busy == 'restore' ? 'Restoring…' : 'Restore Purchases',
                ),
              ),
              TextButton(
                onPressed: () => Handoff.openExternal(appleEulaUrl),
                child: const Text('Terms of Use'),
              ),
              TextButton(
                onPressed: () => Handoff.openExternal(Config.privacyUrl),
                child: const Text('Privacy Policy'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
