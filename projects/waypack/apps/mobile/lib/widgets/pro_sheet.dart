import 'package:flutter/material.dart';
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

/// The "Waypack Pro" sheet in the iPhone app: what Pro adds, the annual subscription (with the
/// free week when the person is eligible), lifetime, Restore Purchases and the terms App Review
/// asks for (guideline 3.1.2).
Future<void> showProSheet(BuildContext context) {
  final s = context.read<AppState>();
  s.pro.loadProducts();
  return showPaperSheet<void>(context, builder: (_) => const ProSheet());
}

class ProSheet extends StatelessWidget {
  const ProSheet({super.key});

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
    final body = TextStyle(fontSize: 14, height: 1.45, color: p.ink);
    final small = TextStyle(fontSize: 12, height: 1.45, color: p.muted);

    Widget perk(IconData icon, String text) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: p.accent),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: body)),
        ],
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Waypack Pro',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: p.ink,
            ),
          ),
          const SizedBox(height: 12),
          perk(
            Icons.map_outlined,
            'Offline maps for every trip: up to 4 map areas each, cut for you when a trip is published.',
          ),
          perk(
            Icons.luggage_outlined,
            'Up to 10 active trips at once (free: 1).',
          ),
          perk(
            Icons.devices_outlined,
            'Works on your account everywhere: iPhone, Mac and the web.',
          ),
          const SizedBox(height: 10),
          if (tier != 'free') ...[
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
            if (annual != null)
              PaperButton(
                key: const Key('buy-annual'),
                expand: true,
                label: pro.busy == ProStore.annualId
                    ? 'Opening the App Store…'
                    : pro.introEligible
                    ? 'Try 1 week free, then ${annual.price}/year'
                    : '${annual.price} per year',
                onPressed: userId == null || pro.busy != null
                    ? null
                    : () => pro.buy(ProStore.annualId, userId: userId),
              ),
            if (annual != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 12),
                child: Text(
                  '${pro.introEligible ? 'Free for 1 week, then ' : ''}${annual.price} a year, charged to your Apple Account. '
                  'Renews automatically unless you cancel at least 24 hours before the end of the current period; '
                  'manage or cancel it in your Apple Account settings.',
                  style: small,
                  textAlign: TextAlign.center,
                ),
              ),
            if (lifetime != null)
              PaperButton(
                key: const Key('buy-lifetime'),
                expand: true,
                kind: PaperButtonKind.secondary,
                label: pro.busy == ProStore.lifetimeId
                    ? 'Opening the App Store…'
                    : 'Lifetime · ${lifetime.price} once',
                onPressed: userId == null || pro.busy != null
                    ? null
                    : () => pro.buy(ProStore.lifetimeId, userId: userId),
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
          const SizedBox(height: 8),
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
