import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kds_app/main.dart';

void main() {
  testWidgets('switching categories rebuilds the home screen safely',
      (WidgetTester tester) async {
    const restaurants = <Restaurant>[
      Restaurant(
        id: 1,
        name: 'Test Kitchen',
        cuisine: 'Bangla',
        rating: 4.5,
        minutes: 25,
        deliveryFee: 40,
        color: kdsYellow,
        menu: [
          MenuItem(
            name: 'Rice Bowl',
            description: 'Food item',
            price: 120,
            tag: 'Popular',
            category: 'food',
          ),
          MenuItem(
            name: 'Cough Syrup',
            description: 'Medicine item',
            price: 80,
            tag: 'New',
            category: 'medicine',
          ),
        ],
      ),
    ];

    var selectedCategory = 'food';

    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) {
            return HomeScreen(
              restaurants: restaurants,
              onAdd: (_) async {},
              onOpenRestaurant: (_) {},
              session: null,
              onAuthRequested: () async => null,
              onLogout: () {},
              selectedCategory: selectedCategory,
              onCategorySelected: (value) {
                setState(() {
                  selectedCategory = value;
                });
              },
            );
          },
        ),
      ),
    );

    expect(find.text('Fresh meals, snacks, and daily favorites.'), findsOneWidget);
    expect(find.text('Test Kitchen'), findsOneWidget);

    await tester.tap(find.text('Medicine').first);
    await tester.pumpAndSettle();

    expect(find.text('Health essentials and quick pharmacy picks.'),
        findsOneWidget);
    expect(find.text('Test Kitchen'), findsOneWidget);
  });
}
