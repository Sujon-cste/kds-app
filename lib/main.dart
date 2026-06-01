import 'dart:convert';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const KdsApp());
}

const kdsYellow = Color(0xFFFFD43B);
const kdsRedOrange = Color(0xFFFF4D2E);
const kdsInk = Color(0xFF232323);
const kdsMuted = Color(0xFF71717A);
const kdsSurface = Color(0xFFFFFBF0);

class KdsApp extends StatelessWidget {
  const KdsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KDS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: kdsYellow,
          primary: kdsYellow,
          secondary: kdsRedOrange,
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: kdsSurface,
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor: kdsSurface,
          foregroundColor: kdsInk,
          elevation: 0,
          centerTitle: false,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: kdsRedOrange,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: Colors.black.withValues(alpha: .06)),
          ),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}

class Restaurant {
  const Restaurant({
    required this.id,
    required this.name,
    required this.cuisine,
    required this.rating,
    required this.minutes,
    required this.deliveryFee,
    required this.color,
    required this.menu,
    this.approved = true,
    this.favorite = false,
  });

  final int id;
  final String name;
  final String cuisine;
  final double rating;
  final int minutes;
  final int deliveryFee;
  final Color color;
  final List<MenuItem> menu;
  final bool approved;
  final bool favorite;

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id'] as int,
      name: json['name'] as String,
      cuisine: json['cuisine'] as String,
      rating: (json['rating'] as num).toDouble(),
      minutes: json['minutes'] as int,
      deliveryFee: json['deliveryFee'] as int,
      color: _colorFromHex(json['colorHex'] as String?),
      approved: json['approved'] as bool? ?? true,
      menu: (json['menu'] as List<dynamic>)
          .map((item) => MenuItem.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  static Color _colorFromHex(String? rawColor) {
    final value = int.tryParse((rawColor ?? '0xFFFFE7A3').replaceFirst('#', '0xFF'));
    return Color(value ?? 0xFFFFE7A3);
  }
}

class MenuItem {
  const MenuItem({
    required this.name,
    required this.description,
    required this.price,
    required this.tag,
  });

  final String name;
  final String description;
  final int price;
  final String tag;

  Map<String, Object> toJson() {
    return {
      'name': name,
      'description': description,
      'price': price,
      'tag': tag,
    };
  }

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      name: json['name'] as String,
      description: json['description'] as String,
      price: json['price'] as int,
      tag: json['tag'] as String,
    );
  }
}

class CartLine {
  CartLine(this.item, this.quantity);

  final MenuItem item;
  int quantity;

  Map<String, Object> toJson() {
    return {
      'item': item.toJson(),
      'quantity': quantity,
    };
  }

  factory CartLine.fromJson(Map<String, dynamic> json) {
    return CartLine(
      MenuItem.fromJson(json['item'] as Map<String, dynamic>),
      json['quantity'] as int,
    );
  }
}

enum UserRole {
  customer,
  admin,
}

enum OrderStatus {
  pending,
  accepted,
  preparing,
  riderAssigned,
  onTheWay,
  delivered,
  rejected,
}

extension OrderStatusLabel on OrderStatus {
  String get label {
    return switch (this) {
      OrderStatus.pending => 'Pending',
      OrderStatus.accepted => 'Accepted',
      OrderStatus.preparing => 'Preparing',
      OrderStatus.riderAssigned => 'Rider assigned',
      OrderStatus.onTheWay => 'On the way',
      OrderStatus.delivered => 'Delivered',
      OrderStatus.rejected => 'Rejected',
    };
  }
}

class CustomerOrder {
  CustomerOrder({
    required this.id,
    required this.customerName,
    required this.phone,
    required this.address,
    required this.restaurantName,
    required this.lines,
    required this.subtotal,
    required this.deliveryFee,
    required this.createdAt,
    this.status = OrderStatus.pending,
    this.riderName,
  });

  final String id;
  final String customerName;
  final String phone;
  final String address;
  final String restaurantName;
  final List<CartLine> lines;
  final int subtotal;
  final int deliveryFee;
  final DateTime createdAt;
  OrderStatus status;
  String? riderName;

  int get total => subtotal + deliveryFee;

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'customerName': customerName,
      'phone': phone,
      'address': address,
      'restaurantName': restaurantName,
      'lines': lines.map((line) => line.toJson()).toList(),
      'subtotal': subtotal,
      'deliveryFee': deliveryFee,
      'createdAt': createdAt.toIso8601String(),
      'status': status.name,
      'riderName': riderName,
    };
  }

  factory CustomerOrder.fromJson(Map<String, dynamic> json) {
    return CustomerOrder(
      id: json['id'] as String,
      customerName: json['customerName'] as String,
      phone: json['phone'] as String,
      address: json['address'] as String,
      restaurantName: json['restaurantName'] as String,
      lines: (json['lines'] as List<dynamic>)
          .map((line) => CartLine.fromJson(line as Map<String, dynamic>))
          .toList(),
      subtotal: json['subtotal'] as int,
      deliveryFee: json['deliveryFee'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      status: OrderStatus.values.byName(json['status'] as String),
      riderName: json['riderName'] as String?,
    );
  }
}

final kdsOrders = <CustomerOrder>[];

class AuthSession {
  const AuthSession({
    required this.token,
    required this.role,
    required this.phone,
    required this.name,
  });

  final String token;
  final UserRole role;
  final String phone;
  final String name;
}

class ApiService {
  static const baseUrl = String.fromEnvironment(
    'KDS_API_BASE_URL',
    defaultValue: 'http://127.0.0.1:4000',
  );

  static Future<AuthSession> signIn({
    required String phone,
    required String password,
  }) async {
    final response = await _postJson(
      '/auth/signin',
      {'phone': phone, 'password': password},
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    return _sessionFrom(response);
  }

  static Future<AuthSession> signUp({
    required String name,
    required String phone,
    required String password,
  }) async {
    final response = await _postJson(
      '/auth/signup',
      {'name': name, 'phone': phone, 'password': password},
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    return _sessionFrom(response);
  }

  static AuthSession _sessionFrom(http.Response response) {
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final user = decoded['user'] as Map<String, dynamic>;
    return AuthSession(
      token: decoded['token'] as String,
      role: UserRole.values.byName(user['role'] as String),
      phone: user['phone'] as String,
      name: user['name'] as String,
    );
  }

  static Future<List<Restaurant>> fetchRestaurants() async {
    final response = await _getJson('/restaurants');
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['restaurants'] as List<dynamic>)
        .map((restaurant) => Restaurant.fromJson(restaurant as Map<String, dynamic>))
        .toList();
  }

  static Future<Restaurant> createRestaurant({
    required AuthSession session,
    required String name,
    required String cuisine,
    required List<MenuItem> menu,
    int minutes = 25,
    int deliveryFee = 40,
  }) async {
    final response = await _postJson(
      '/restaurants',
      {
        'name': name,
        'cuisine': cuisine,
        'minutes': minutes,
        'deliveryFee': deliveryFee,
        'menu': menu.map((item) => item.toJson()).toList(),
      },
      token: session.token,
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return Restaurant.fromJson(decoded['restaurant'] as Map<String, dynamic>);
  }

  static Future<Restaurant> updateRestaurant({
    required AuthSession session,
    required Restaurant restaurant,
    required String name,
    required String cuisine,
    required List<MenuItem> menu,
    required int minutes,
    required int deliveryFee,
  }) async {
    final response = await _putJson(
      '/restaurants/${restaurant.id}',
      {
        'name': name,
        'cuisine': cuisine,
        'rating': restaurant.rating,
        'minutes': minutes,
        'deliveryFee': deliveryFee,
        'colorHex':
            '0x${restaurant.color.toARGB32().toRadixString(16).padLeft(8, '0').toUpperCase()}',
        'menu': menu.map((item) => item.toJson()).toList(),
      },
      token: session.token,
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return Restaurant.fromJson(decoded['restaurant'] as Map<String, dynamic>);
  }

  static Future<CustomerOrder> createOrder({
    required AuthSession session,
    required String restaurantName,
    required List<CartLine> lines,
    required int subtotal,
    required int deliveryFee,
  }) async {
    final response = await _postJson(
      '/orders',
      {
        'restaurantName': restaurantName,
        'customerName': session.name,
        'phone': session.phone,
        'address': 'Khilkhet, Dhaka',
        'subtotal': subtotal,
        'deliveryFee': deliveryFee,
        'lines': lines.map((line) => line.toJson()).toList(),
      },
      token: session.token,
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return CustomerOrder.fromJson(decoded['order'] as Map<String, dynamic>);
  }

  static Future<http.Response> _postJson(
    String path,
    Map<String, Object?> body, {
    String? token,
  }) async {
    try {
      return await http.post(
        Uri.parse('$baseUrl$path'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );
    } catch (_) {
      throw Exception('KDS server is offline. Start the backend API and try again.');
    }
  }

  static Future<List<CustomerOrder>> fetchOrders(AuthSession session) async {
    final response = await _getJson('/orders', token: session.token);
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded['orders'] as List<dynamic>)
        .map((order) => CustomerOrder.fromJson(order as Map<String, dynamic>))
        .toList();
  }

  static Future<CustomerOrder> fetchOrder({
    required AuthSession session,
    required String orderId,
  }) async {
    final response = await _getJson('/orders/$orderId', token: session.token);
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return CustomerOrder.fromJson(decoded['order'] as Map<String, dynamic>);
  }

  static Future<http.Response> _getJson(String path, {String? token}) async {
    try {
      return await http.get(
        Uri.parse('$baseUrl$path'),
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );
    } catch (_) {
      throw Exception('KDS server is offline. Start the backend API and try again.');
    }
  }

  static Future<CustomerOrder> updateOrderStatus({
    required AuthSession session,
    required CustomerOrder order,
    required OrderStatus status,
    String? riderName,
  }) async {
    final response = await _patchJson(
      '/orders/${order.id}/status',
      {
        'status': status.name,
        'riderName': riderName,
      },
      token: session.token,
    );
    if (response.statusCode >= 400) {
      throw Exception(_messageFrom(response));
    }

    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return CustomerOrder.fromJson(decoded['order'] as Map<String, dynamic>);
  }

  static Future<http.Response> _patchJson(
    String path,
    Map<String, Object?> body, {
    String? token,
  }) async {
    try {
      return await http.patch(
        Uri.parse('$baseUrl$path'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );
    } catch (_) {
      throw Exception('KDS server is offline. Start the backend API and try again.');
    }
  }

  static Future<http.Response> _putJson(
    String path,
    Map<String, Object?> body, {
    String? token,
  }) async {
    try {
      return await http.put(
        Uri.parse('$baseUrl$path'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );
    } catch (_) {
      throw Exception('KDS server is offline. Start the backend API and try again.');
    }
  }

  static String _messageFrom(http.Response response) {
    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      return decoded['message'] as String? ?? 'Request failed';
    } catch (_) {
      return 'Request failed';
    }
  }
}

final kdsRestaurants = <Restaurant>[];


class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final nameController = TextEditingController(text: 'KDS Customer');
  final phoneController = TextEditingController(text: '01700000000');
  final passwordController = TextEditingController(text: 'admin123');
  bool signUpMode = false;
  bool submitting = false;
  String? errorMessage;

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      submitting = true;
      errorMessage = null;
    });

    try {
      final session = signUpMode
          ? await ApiService.signUp(
              name: nameController.text,
              phone: phoneController.text,
              password: passwordController.text,
            )
          : await ApiService.signIn(
              phone: phoneController.text,
              password: passwordController.text,
            );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ShellScreen(session: session),
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => errorMessage = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 28),
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: kdsYellow,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: kdsRedOrange.withValues(alpha: .18),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: const Center(
                child: Text(
                  'KDS',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: kdsInk,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'Welcome to KDS',
              style: TextStyle(
                fontSize: 34,
                height: 1.05,
                fontWeight: FontWeight.w900,
                color: kdsInk,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Sign in with mobile number and password. Admin access is controlled from the database.',
              style: TextStyle(fontSize: 16, color: kdsMuted, height: 1.45),
            ),
            const SizedBox(height: 32),
            _Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: false,
                        icon: Icon(Icons.login),
                        label: Text('Sign in'),
                      ),
                      ButtonSegment(
                        value: true,
                        icon: Icon(Icons.person_add),
                        label: Text('Sign up'),
                      ),
                    ],
                    selected: {signUpMode},
                    onSelectionChanged: submitting
                        ? null
                        : (selection) {
                            setState(() {
                              signUpMode = selection.first;
                              errorMessage = null;
                            });
                          },
                  ),
                  const SizedBox(height: 18),
                  if (signUpMode) ...[
                    TextField(
                      controller: nameController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                        floatingLabelBehavior: FloatingLabelBehavior.always,
                        isDense: false,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 18,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(Radius.circular(16)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                      floatingLabelBehavior: FloatingLabelBehavior.always,
                      prefixText: '+88 ',
                      isDense: false,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 18,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      floatingLabelBehavior: FloatingLabelBehavior.always,
                      isDense: false,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 18,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                      ),
                    ),
                  ),
                  if (!signUpMode) ...[
                    const SizedBox(height: 12),
                    const _InfoStrip(
                      icon: Icons.admin_panel_settings,
                      title: 'Admin demo',
                      subtitle: '01700000000 / admin123 opens the admin panel.',
                    ),
                  ],
                  if (errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      errorMessage!,
                      style: const TextStyle(
                        color: kdsRedOrange,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: submitting ? null : submit,
                    child: Text(
                      submitting ? 'Please wait...' : (signUpMode ? 'Create account' : 'Sign in'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const _InfoStrip(
              icon: Icons.payments_rounded,
              title: 'Cash on delivery',
              subtitle: 'bKash merchant payout support planned for operations.',
            ),
          ],
        ),
      ),
    );
  }
}

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key, required this.session});

  final AuthSession session;

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int index = 0;
  Restaurant? selectedRestaurant;
  final cart = <CartLine>[];
  final orders = kdsOrders;
  final restaurants = kdsRestaurants;
  bool ordersLoaded = false;

  int get cartItemCount => cart.fold(0, (sum, line) => sum + line.quantity);

  @override
  void initState() {
    super.initState();
    loadOrders();
  }

  Future<void> loadOrders() async {
    try {
      final savedRestaurants = await ApiService.fetchRestaurants();
      if (widget.session.role == UserRole.admin) {
        final savedOrders = await ApiService.fetchOrders(widget.session);
        if (!mounted) {
          return;
        }
        setState(() {
          restaurants
            ..clear()
            ..addAll(savedRestaurants);
          orders
            ..clear()
            ..addAll(savedOrders);
          ordersLoaded = true;
        });
      } else {
        setState(() {
          restaurants
            ..clear()
            ..addAll(savedRestaurants);
          ordersLoaded = true;
        });
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => ordersLoaded = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void addToCart(MenuItem item) {
    final existing = cart.where((line) => line.item.name == item.name).toList();
    setState(() {
      if (existing.isEmpty) {
        cart.add(CartLine(item, 1));
      } else {
        existing.first.quantity++;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${item.name} added to cart'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void logout() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<CustomerOrder?> placeOrder() async {
    final subtotal = cart.fold(0, (sum, line) => sum + line.item.price * line.quantity);
    final restaurantName = restaurants
        .firstWhere(
          (restaurant) => restaurant.menu.any(
            (item) => cart.any((line) => line.item.name == item.name),
          ),
          orElse: () => restaurants.first,
        )
        .name;
    final orderLines = cart.map((line) => CartLine(line.item, line.quantity)).toList();

    try {
      final order = await ApiService.createOrder(
        session: widget.session,
        restaurantName: restaurantName,
        lines: orderLines,
        subtotal: subtotal,
        deliveryFee: CartScreen.fixedDeliveryFee,
      );

      if (!mounted) {
        return null;
      }
      setState(() {
        orders.insert(0, order);
        cart.clear();
        index = 2;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Admin notified for order ${order.id}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return order;
    } catch (error) {
      if (!mounted) {
        return null;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return null;
    }
  }

  Future<void> updateOrder(CustomerOrder order, OrderStatus status, {String? riderName}) async {
    final updatedOrder = await ApiService.updateOrderStatus(
      session: widget.session,
      order: order,
      status: status,
      riderName: riderName,
    );
    setState(() {
      final index = orders.indexWhere((existing) => existing.id == order.id);
      if (index >= 0) {
        orders[index] = updatedOrder;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!ordersLoaded) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (widget.session.role == UserRole.admin) {
      return AdminScreen(
        session: widget.session,
        orders: orders,
        restaurants: restaurants,
        onUpdateOrder: updateOrder,
        onLogout: logout,
        onRestaurantCreated: (restaurant) {
          setState(() => restaurants.insert(0, restaurant));
        },
        onRestaurantUpdated: (restaurant) {
          setState(() {
            final index = restaurants.indexWhere((entry) => entry.id == restaurant.id);
            if (index >= 0) {
              restaurants[index] = restaurant;
            }
          });
        },
      );
    }

    final pages = [
      selectedRestaurant == null
          ? HomeScreen(
              restaurants: restaurants,
              onAdd: addToCart,
              onOpenRestaurant: (restaurant) {
                setState(() => selectedRestaurant = restaurant);
              },
              onLogout: logout,
            )
          : RestaurantScreen(
              restaurant: selectedRestaurant!,
              onAdd: addToCart,
              onBack: () => setState(() => selectedRestaurant = null),
            ),
      SearchScreen(
        restaurants: restaurants,
        onAdd: addToCart,
        onOpenRestaurant: (restaurant) {
          setState(() {
            selectedRestaurant = restaurant;
            index = 0;
          });
        },
      ),
      CartScreen(
        session: widget.session,
        cart: cart,
        onChanged: () => setState(() {}),
        onPlaceOrder: placeOrder,
      ),
      ProfileScreen(
        session: widget.session,
        onLogout: logout,
      ),
    ];

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: pages[index],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          setState(() {
            index = value;
            if (value != 0) {
              selectedRestaurant = null;
            }
          });
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Food',
          ),
          const NavigationDestination(
            icon: Icon(Icons.search),
            selectedIcon: Icon(Icons.manage_search),
            label: 'Search',
          ),
          NavigationDestination(
            icon: _BadgeIcon(
              icon: Icons.shopping_bag_outlined,
              count: cartItemCount,
            ),
            selectedIcon: _BadgeIcon(
              icon: Icons.shopping_bag,
              count: cartItemCount,
            ),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.restaurants,
    required this.onAdd,
    required this.onOpenRestaurant,
    required this.onLogout,
  });

  final List<Restaurant> restaurants;
  final ValueChanged<MenuItem> onAdd;
  final ValueChanged<Restaurant> onOpenRestaurant;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Deliver to', style: TextStyle(fontSize: 12, color: kdsMuted)),
            Text('Khilkhet, Dhaka', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.favorite_rounded, color: kdsRedOrange),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: onLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const _PromoBanner(),
          const SizedBox(height: 18),
          const Text(
            'Nearby restaurants',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (restaurants.isEmpty)
            const _InfoStrip(
              icon: Icons.storefront,
              title: 'No restaurants yet',
              subtitle: 'Admin can upload restaurants from the admin panel.',
            )
          else
            for (final restaurant in restaurants) ...[
              RestaurantCard(
                restaurant: restaurant,
                onAdd: onAdd,
                onOpen: onOpenRestaurant,
              ),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

class RestaurantCard extends StatelessWidget {
  const RestaurantCard({
    super.key,
    required this.restaurant,
    required this.onAdd,
    required this.onOpen,
  });

  final Restaurant restaurant;
  final ValueChanged<MenuItem> onAdd;
  final ValueChanged<Restaurant> onOpen;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => onOpen(restaurant),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  color: restaurant.color,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.restaurant_menu,
                  color: kdsInk.withValues(alpha: .72),
                  size: 38,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            restaurant.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        if (restaurant.favorite)
                          const Icon(
                            Icons.favorite_rounded,
                            color: kdsRedOrange,
                            size: 18,
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      restaurant.cuisine,
                      style: const TextStyle(color: kdsMuted),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _Pill(icon: Icons.star, text: '${restaurant.rating}'),
                        _Pill(
                          icon: Icons.schedule,
                          text: '${restaurant.minutes} min',
                        ),
                        _Pill(
                          icon: Icons.delivery_dining,
                          text: 'Tk ${restaurant.deliveryFee}',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RestaurantScreen extends StatelessWidget {
  const RestaurantScreen({
    super.key,
    required this.restaurant,
    required this.onAdd,
    required this.onBack,
  });

  final Restaurant restaurant;
  final ValueChanged<MenuItem> onAdd;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back),
        ),
        title: Text(restaurant.name),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            height: 150,
            decoration: BoxDecoration(
              color: restaurant.color,
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Center(
              child: Icon(Icons.local_dining_rounded, size: 72, color: kdsInk),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            restaurant.cuisine,
            style: const TextStyle(color: kdsMuted, fontSize: 16),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill(icon: Icons.star, text: '${restaurant.rating} rating'),
              _Pill(icon: Icons.schedule, text: '${restaurant.minutes} min'),
              _Pill(
                icon: Icons.delivery_dining,
                text: 'Fixed fee Tk ${restaurant.deliveryFee}',
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Menu',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          for (final item in restaurant.menu) ...[
            MenuItemTile(item: item, onAdd: onAdd),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class MenuItemTile extends StatelessWidget {
  const MenuItemTile({super.key, required this.item, required this.onAdd});

  final MenuItem item;
  final ValueChanged<MenuItem> onAdd;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Chip(
                        label: Text(item.tag),
                        backgroundColor: kdsYellow.withValues(alpha: .45),
                      ),
                    ],
                  ),
                  Text(item.description, style: const TextStyle(color: kdsMuted)),
                  const SizedBox(height: 10),
                  Text(
                    'Tk ${item.price}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: kdsRedOrange,
                    ),
                  ),
                ],
              ),
            ),
            IconButton.filled(
              onPressed: () => onAdd(item),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
      ),
    );
  }
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({
    super.key,
    required this.restaurants,
    required this.onAdd,
    required this.onOpenRestaurant,
  });

  final List<Restaurant> restaurants;
  final ValueChanged<MenuItem> onAdd;
  final ValueChanged<Restaurant> onOpenRestaurant;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final lower = query.toLowerCase();
    final results = widget.restaurants.where((restaurant) {
      final menuMatch = restaurant.menu.any(
        (item) => item.name.toLowerCase().contains(lower),
      );
      return restaurant.name.toLowerCase().contains(lower) ||
          restaurant.cuisine.toLowerCase().contains(lower) ||
          menuMatch;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            onChanged: (value) => setState(() => query = value),
            decoration: const InputDecoration(
              hintText: 'Search restaurants or food',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(18)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          for (final restaurant in results) ...[
            RestaurantCard(
              restaurant: restaurant,
              onAdd: widget.onAdd,
              onOpen: widget.onOpenRestaurant,
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class CartScreen extends StatelessWidget {
  const CartScreen({
    super.key,
    required this.session,
    required this.cart,
    required this.onChanged,
    required this.onPlaceOrder,
  });

  final AuthSession session;
  final List<CartLine> cart;
  final VoidCallback onChanged;
  final Future<CustomerOrder?> Function() onPlaceOrder;
  static const fixedDeliveryFee = 40;

  int get subtotal => cart.fold(0, (sum, line) => sum + line.item.price * line.quantity);
  int get total => subtotal + (cart.isEmpty ? 0 : fixedDeliveryFee);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: cart.isEmpty
          ? const Center(
              child: Text(
                'Your cart is empty',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final line in cart) ...[
                  _CartLineTile(line: line, onChanged: onChanged),
                  const SizedBox(height: 10),
                ],
                const SizedBox(height: 12),
                _Panel(
                  child: Column(
                    children: [
                      _AmountRow(label: 'Subtotal', amount: subtotal),
                      const SizedBox(height: 8),
                      const _AmountRow(
                        label: 'Fixed delivery fee',
                        amount: fixedDeliveryFee,
                      ),
                      const Divider(height: 28),
                      _AmountRow(label: 'Total', amount: total, bold: true),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: () async {
                          final order = await onPlaceOrder();
                          if (order == null || !context.mounted) {
                            return;
                          }
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => TrackingScreen(
                                session: session,
                                initialOrder: order,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.check_circle),
                        label: const Text('Place order - Cash on delivery'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({required this.line, required this.onChanged});

  final CartLine line;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.item.name,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  Text('Tk ${line.item.price}', style: const TextStyle(color: kdsMuted)),
                ],
              ),
            ),
            IconButton(
              onPressed: () {
                if (line.quantity > 1) {
                  line.quantity--;
                }
                onChanged();
              },
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('${line.quantity}', style: const TextStyle(fontWeight: FontWeight.w900)),
            IconButton(
              onPressed: () {
                line.quantity++;
                onChanged();
              },
              icon: const Icon(Icons.add_circle, color: kdsRedOrange),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.session,
    required this.onLogout,
  });

  final AuthSession session;
  final VoidCallback onLogout;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<List<CustomerOrder>> ordersFuture;

  @override
  void initState() {
    super.initState();
    ordersFuture = ApiService.fetchOrders(widget.session);
  }

  void refreshOrders() {
    setState(() => ordersFuture = ApiService.fetchOrders(widget.session));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: refreshOrders,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          refreshOrders();
          await ordersFuture;
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Panel(
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: kdsYellow,
                    child: Icon(Icons.person, color: kdsInk),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.session.name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(widget.session.phone, style: const TextStyle(color: kdsMuted)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'My orders',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            FutureBuilder<List<CustomerOrder>>(
              future: ordersFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  return _InfoStrip(
                    icon: Icons.error_outline,
                    title: 'Could not load orders',
                    subtitle: snapshot.error.toString().replaceFirst('Exception: ', ''),
                  );
                }

                final orders = snapshot.data ?? [];
                if (orders.isEmpty) {
                  return const _EmptyOrdersPanel();
                }

                return Column(
                  children: [
                    for (final order in orders) ...[
                      _MyOrderCard(
                        order: order,
                        onTrack: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => TrackingScreen(
                                session: widget.session,
                                initialOrder: order,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MyOrderCard extends StatelessWidget {
  const _MyOrderCard({
    required this.order,
    required this.onTrack,
  });

  final CustomerOrder order;
  final VoidCallback onTrack;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.id,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                  ),
                ),
                _StatusChip(status: order.status),
              ],
            ),
            const SizedBox(height: 8),
            Text(order.restaurantName, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(
              '${order.lines.length} item${order.lines.length == 1 ? '' : 's'} • Tk ${order.total}',
              style: const TextStyle(color: kdsMuted),
            ),
            if (order.riderName != null) ...[
              const SizedBox(height: 8),
              _Pill(icon: Icons.delivery_dining, text: order.riderName!),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onTrack,
                icon: const Icon(Icons.near_me),
                label: const Text('Track order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TrackingScreen extends StatefulWidget {
  const TrackingScreen({
    super.key,
    required this.session,
    required this.initialOrder,
  });

  final AuthSession session;
  final CustomerOrder initialOrder;

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  late CustomerOrder order;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    order = widget.initialOrder;
    timer = Timer.periodic(const Duration(seconds: 4), (_) => refreshOrder());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> refreshOrder() async {
    if (order.status == OrderStatus.delivered || order.status == OrderStatus.rejected) {
      timer?.cancel();
      return;
    }

    try {
      final updatedOrder = await ApiService.fetchOrder(
        session: widget.session,
        orderId: order.id,
      );
      if (!mounted) {
        return;
      }
      setState(() => order = updatedOrder);
    } catch (_) {
      // Keep the last known status visible if polling temporarily fails.
    }
  }

  int get activeStep {
    return switch (order.status) {
      OrderStatus.pending => 0,
      OrderStatus.accepted => 1,
      OrderStatus.preparing => 2,
      OrderStatus.riderAssigned => 3,
      OrderStatus.onTheWay => 4,
      OrderStatus.delivered => 5,
      OrderStatus.rejected => 0,
    };
  }

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Pending admin approval', 'Admin has been notified and will review this order'),
      ('Order accepted', 'Admin accepted your order'),
      ('Preparing food', 'Kitchen is preparing your items'),
      ('Rider assigned', order.riderName ?? 'A local rider will be assigned'),
      ('On the way', 'Live rider tracking will appear here'),
      ('Delivered', 'Order completed'),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Order tracking')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _InfoStrip(
            icon: Icons.chat_bubble_rounded,
            title: 'WhatsApp updates enabled',
            subtitle: 'Order and delivery status will be sent to the customer.',
          ),
          const SizedBox(height: 16),
          _Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${order.id} • Tk ${order.total}',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                _StatusChip(status: order.status),
                const SizedBox(height: 18),
                if (order.status == OrderStatus.rejected)
                  const _TimelineStep(
                    title: 'Order rejected',
                    subtitle: 'Admin rejected this order',
                    active: true,
                    last: true,
                  )
                else
                  for (var i = 0; i < steps.length; i++)
                  _TimelineStep(
                    title: steps[i].$1,
                    subtitle: steps[i].$2,
                    active: i <= activeStep,
                    last: i == steps.length - 1,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(22),
            ),
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.map_rounded, size: 44, color: kdsMuted),
                  SizedBox(height: 8),
                  Text('Google Maps live tracking placeholder'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AdminScreen extends StatelessWidget {
  const AdminScreen({
    super.key,
    required this.session,
    required this.orders,
    required this.restaurants,
    required this.onUpdateOrder,
    required this.onLogout,
    required this.onRestaurantCreated,
    required this.onRestaurantUpdated,
  });

  final AuthSession session;
  final List<CustomerOrder> orders;
  final List<Restaurant> restaurants;
  final Future<void> Function(CustomerOrder order, OrderStatus status, {String? riderName})
      onUpdateOrder;
  final VoidCallback onLogout;
  final ValueChanged<Restaurant> onRestaurantCreated;
  final ValueChanged<Restaurant> onRestaurantUpdated;

  @override
  Widget build(BuildContext context) {
    final pendingCount = orders.where((order) => order.status == OrderStatus.pending).length;
    final activeCount = orders
        .where(
          (order) =>
              order.status != OrderStatus.delivered && order.status != OrderStatus.rejected,
        )
        .length;
    final deliveredCount =
        orders.where((order) => order.status == OrderStatus.delivered).length;
    final commission = orders
        .where((order) => order.status != OrderStatus.rejected)
        .fold(0, (sum, order) => sum + (order.total * .12).round());

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: [
          IconButton(
            tooltip: 'Add restaurant',
            onPressed: () {
              showDialog<void>(
                context: context,
                builder: (_) => RestaurantFormDialog(
                  session: session,
                  onSaved: onRestaurantCreated,
                ),
              );
            },
            icon: const Icon(Icons.add_business),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              avatar: const Icon(Icons.notifications_active, size: 18),
              label: Text('$pendingCount new'),
              backgroundColor: pendingCount > 0
                  ? kdsYellow.withValues(alpha: .75)
                  : Colors.black.withValues(alpha: .05),
            ),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: onLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Single Super Admin',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetricCard(
                label: 'New orders',
                value: '$pendingCount',
                icon: Icons.notifications_active,
              ),
              _MetricCard(
                label: 'Active orders',
                value: '$activeCount',
                icon: Icons.receipt_long,
              ),
              _MetricCard(
                label: 'Delivered',
                value: '$deliveredCount',
                icon: Icons.check_circle,
              ),
              _MetricCard(
                label: 'Commission',
                value: 'Tk $commission',
                icon: Icons.trending_up,
              ),
            ],
          ),
          const SizedBox(height: 18),
          _InfoStrip(
            icon: Icons.storefront,
            title: 'Restaurants uploaded',
            subtitle: '${restaurants.length} active restaurant${restaurants.length == 1 ? '' : 's'} available to customers.',
          ),
          const SizedBox(height: 12),
          if (restaurants.isEmpty)
            const _InfoStrip(
              icon: Icons.add_business,
              title: 'No restaurants uploaded',
              subtitle: 'Use the add restaurant button to publish your first restaurant.',
            )
          else
            for (final restaurant in restaurants) ...[
              _AdminRestaurantTile(
                restaurant: restaurant,
                onEdit: () {
                  showDialog<void>(
                    context: context,
                    builder: (_) => RestaurantFormDialog(
                      session: session,
                      restaurant: restaurant,
                      onSaved: onRestaurantUpdated,
                    ),
                  );
                },
              ),
              const SizedBox(height: 10),
            ],
          const SizedBox(height: 18),
          const _InfoStrip(
            icon: Icons.chat_bubble_rounded,
            title: 'Live admin notifications',
            subtitle: 'New customer orders appear here as pending orders.',
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Order queue',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
              ),
              Text('${orders.length} total', style: const TextStyle(color: kdsMuted)),
            ],
          ),
          const SizedBox(height: 12),
          if (orders.isEmpty)
            const _EmptyOrdersPanel()
          else
            for (final order in orders) ...[
              _AdminOrderCard(order: order, onUpdateOrder: onUpdateOrder),
              const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({required this.icon, required this.count});

  final IconData icon;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon),
        if (count > 0)
          Positioned(
            right: -8,
            top: -8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: kdsRedOrange,
                borderRadius: BorderRadius.circular(999),
              ),
              constraints: const BoxConstraints(minWidth: 18),
              child: Text(
                '$count',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _AdminRestaurantTile extends StatelessWidget {
  const _AdminRestaurantTile({
    required this.restaurant,
    required this.onEdit,
  });

  final Restaurant restaurant;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: restaurant.color,
          child: const Icon(Icons.storefront, color: kdsInk),
        ),
        title: Text(restaurant.name, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text('${restaurant.cuisine} • ${restaurant.menu.length} menu items'),
        trailing: IconButton(
          tooltip: 'Edit restaurant',
          onPressed: onEdit,
          icon: const Icon(Icons.edit),
        ),
      ),
    );
  }
}

class RestaurantFormDialog extends StatefulWidget {
  const RestaurantFormDialog({
    super.key,
    required this.session,
    required this.onSaved,
    this.restaurant,
  });

  final AuthSession session;
  final ValueChanged<Restaurant> onSaved;
  final Restaurant? restaurant;

  @override
  State<RestaurantFormDialog> createState() => _RestaurantFormDialogState();
}

class _RestaurantFormDialogState extends State<RestaurantFormDialog> {
  final nameController = TextEditingController();
  final cuisineController = TextEditingController();
  final minutesController = TextEditingController(text: '25');
  final feeController = TextEditingController(text: '40');
  final menuRows = <MenuItemFormRow>[];
  bool saving = false;
  String? errorMessage;

  bool get isEditing => widget.restaurant != null;

  @override
  void initState() {
    super.initState();
    final restaurant = widget.restaurant;
    if (restaurant != null) {
      nameController.text = restaurant.name;
      cuisineController.text = restaurant.cuisine;
      minutesController.text = '${restaurant.minutes}';
      feeController.text = '${restaurant.deliveryFee}';
      menuRows.addAll(restaurant.menu.map(MenuItemFormRow.fromItem));
    } else {
      menuRows.add(MenuItemFormRow());
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    cuisineController.dispose();
    minutesController.dispose();
    feeController.dispose();
    for (final row in menuRows) {
      row.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    setState(() {
      saving = true;
      errorMessage = null;
    });

    try {
      final menu = menuRows.map((row) => row.toMenuItem()).toList();
      final restaurant = isEditing
          ? await ApiService.updateRestaurant(
              session: widget.session,
              restaurant: widget.restaurant!,
              name: nameController.text.trim(),
              cuisine: cuisineController.text.trim(),
              minutes: int.tryParse(minutesController.text) ?? 25,
              deliveryFee: int.tryParse(feeController.text) ?? 40,
              menu: menu,
            )
          : await ApiService.createRestaurant(
              session: widget.session,
              name: nameController.text.trim(),
              cuisine: cuisineController.text.trim(),
              minutes: int.tryParse(minutesController.text) ?? 25,
              deliveryFee: int.tryParse(feeController.text) ?? 40,
              menu: menu,
            );
      if (!mounted) {
        return;
      }
      widget.onSaved(restaurant);
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => errorMessage = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(isEditing ? 'Edit restaurant' : 'Add restaurant'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _DialogField(controller: nameController, label: 'Restaurant name'),
            const SizedBox(height: 12),
            _DialogField(controller: cuisineController, label: 'Cuisine'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _DialogField(
                    controller: minutesController,
                    label: 'Minutes',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DialogField(
                    controller: feeController,
                    label: 'Delivery fee',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const Divider(height: 28),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Menu items',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton.filledTonal(
                  tooltip: 'Add menu item',
                  onPressed: () => setState(() => menuRows.add(MenuItemFormRow())),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < menuRows.length; i++) ...[
              _MenuItemEditor(
                row: menuRows[i],
                index: i,
                canRemove: menuRows.length > 1,
                onRemove: () {
                  setState(() {
                    final row = menuRows.removeAt(i);
                    row.dispose();
                  });
                },
              ),
              const SizedBox(height: 12),
            ],
            if (errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(errorMessage!, style: const TextStyle(color: kdsRedOrange)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: saving ? null : save,
          child: Text(saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')),
        ),
      ],
    );
  }
}

class MenuItemFormRow {
  MenuItemFormRow({
    String name = '',
    String description = '',
    String price = '',
    String tag = 'Popular',
  })  : nameController = TextEditingController(text: name),
        descriptionController = TextEditingController(text: description),
        priceController = TextEditingController(text: price),
        tagController = TextEditingController(text: tag);

  factory MenuItemFormRow.fromItem(MenuItem item) {
    return MenuItemFormRow(
      name: item.name,
      description: item.description,
      price: '${item.price}',
      tag: item.tag,
    );
  }

  final TextEditingController nameController;
  final TextEditingController descriptionController;
  final TextEditingController priceController;
  final TextEditingController tagController;

  MenuItem toMenuItem() {
    return MenuItem(
      name: nameController.text.trim(),
      description: descriptionController.text.trim(),
      price: int.tryParse(priceController.text) ?? 0,
      tag: tagController.text.trim().isEmpty ? 'Item' : tagController.text.trim(),
    );
  }

  void dispose() {
    nameController.dispose();
    descriptionController.dispose();
    priceController.dispose();
    tagController.dispose();
  }
}

class _MenuItemEditor extends StatelessWidget {
  const _MenuItemEditor({
    required this.row,
    required this.index,
    required this.canRemove,
    required this.onRemove,
  });

  final MenuItemFormRow row;
  final int index;
  final bool canRemove;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .04),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Item ${index + 1}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                tooltip: 'Remove item',
                onPressed: canRemove ? onRemove : null,
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          _DialogField(controller: row.nameController, label: 'Item name'),
          const SizedBox(height: 10),
          _DialogField(controller: row.descriptionController, label: 'Description'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _DialogField(
                  controller: row.priceController,
                  label: 'Price',
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: _DialogField(controller: row.tagController, label: 'Tag')),
            ],
          ),
        ],
      ),
    );
  }
}

class _DialogField extends StatelessWidget {
  const _DialogField({
    required this.controller,
    required this.label,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
      ),
    );
  }
}

class _AdminOrderCard extends StatelessWidget {
  const _AdminOrderCard({
    required this.order,
    required this.onUpdateOrder,
  });

  final CustomerOrder order;
  final Future<void> Function(CustomerOrder order, OrderStatus status, {String? riderName})
      onUpdateOrder;

  @override
  Widget build(BuildContext context) {
    final isClosed =
        order.status == OrderStatus.delivered || order.status == OrderStatus.rejected;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.id,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                ),
                _StatusChip(status: order.status),
              ],
            ),
            const SizedBox(height: 8),
            Text(order.restaurantName, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(
              '${order.customerName} • ${order.phone}',
              style: const TextStyle(color: kdsMuted),
            ),
            Text(order.address, style: const TextStyle(color: kdsMuted)),
            const Divider(height: 24),
            for (final line in order.lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${line.quantity} x ${line.item.name}  •  Tk ${line.item.price} each',
                      ),
                    ),
                    Text('Tk ${line.item.price * line.quantity}'),
                  ],
                ),
              ),
            const Divider(height: 24),
            _AmountRow(label: 'Items subtotal', amount: order.subtotal),
            const SizedBox(height: 6),
            _AmountRow(label: 'Delivery fee', amount: order.deliveryFee),
            const SizedBox(height: 8),
            _AmountRow(label: 'Total', amount: order.total, bold: true),
            if (order.riderName != null) ...[
              const SizedBox(height: 8),
              _Pill(icon: Icons.delivery_dining, text: order.riderName!),
            ],
            const SizedBox(height: 14),
            if (isClosed)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: null,
                  icon: const Icon(Icons.lock),
                  label: Text(order.status.label),
                ),
              )
            else
              _OrderActions(order: order, onUpdateOrder: onUpdateOrder),
          ],
        ),
      ),
    );
  }
}

class _OrderActions extends StatelessWidget {
  const _OrderActions({
    required this.order,
    required this.onUpdateOrder,
  });

  final CustomerOrder order;
  final Future<void> Function(CustomerOrder order, OrderStatus status, {String? riderName})
      onUpdateOrder;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (order.status == OrderStatus.pending) ...[
          FilledButton.icon(
            onPressed: () => onUpdateOrder(order, OrderStatus.accepted),
            icon: const Icon(Icons.check),
            label: const Text('Accept'),
          ),
          OutlinedButton.icon(
            onPressed: () => onUpdateOrder(order, OrderStatus.rejected),
            icon: const Icon(Icons.close),
            label: const Text('Reject'),
          ),
        ],
        if (order.status == OrderStatus.accepted)
          FilledButton.icon(
            onPressed: () => onUpdateOrder(order, OrderStatus.preparing),
            icon: const Icon(Icons.soup_kitchen),
            label: const Text('Start preparing'),
          ),
        if (order.status == OrderStatus.preparing)
          FilledButton.icon(
            onPressed: () => onUpdateOrder(
              order,
              OrderStatus.riderAssigned,
              riderName: 'Rider Rahim',
            ),
            icon: const Icon(Icons.assignment_ind),
            label: const Text('Assign rider'),
          ),
        if (order.status == OrderStatus.riderAssigned)
          FilledButton.icon(
            onPressed: () => onUpdateOrder(order, OrderStatus.onTheWay),
            icon: const Icon(Icons.delivery_dining),
            label: const Text('Dispatch'),
          ),
        if (order.status == OrderStatus.onTheWay)
          FilledButton.icon(
            onPressed: () => onUpdateOrder(order, OrderStatus.delivered),
            icon: const Icon(Icons.done_all),
            label: const Text('Mark delivered'),
          ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final OrderStatus status;

  Color get color {
    return switch (status) {
      OrderStatus.pending => kdsYellow,
      OrderStatus.accepted => const Color(0xFFBFDBFE),
      OrderStatus.preparing => const Color(0xFFFDE68A),
      OrderStatus.riderAssigned => const Color(0xFFC7D2FE),
      OrderStatus.onTheWay => const Color(0xFFA7F3D0),
      OrderStatus.delivered => const Color(0xFFBBF7D0),
      OrderStatus.rejected => const Color(0xFFFECACA),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(status.label),
      backgroundColor: color,
      side: BorderSide.none,
    );
  }
}

class _EmptyOrdersPanel extends StatelessWidget {
  const _EmptyOrdersPanel();

  @override
  Widget build(BuildContext context) {
    return const _Panel(
      child: Column(
        children: [
          Icon(Icons.receipt_long, color: kdsMuted, size: 42),
          SizedBox(height: 10),
          Text(
            'No orders yet',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          SizedBox(height: 4),
          Text(
            'Place an order from the customer cart to notify admin.',
            textAlign: TextAlign.center,
            style: TextStyle(color: kdsMuted),
          ),
        ],
      ),
    );
  }
}

class _PromoBanner extends StatelessWidget {
  const _PromoBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kdsYellow,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Khilkhet launch offer',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
                SizedBox(height: 8),
                Text('Use KDS40 for local food delivery deals.'),
              ],
            ),
          ),
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.local_offer, color: kdsRedOrange, size: 34),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .05),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: kdsRedOrange),
          const SizedBox(width: 5),
          Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _InfoStrip extends StatelessWidget {
  const _InfoStrip({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withValues(alpha: .06)),
      ),
      child: Row(
        children: [
          Icon(icon, color: kdsRedOrange),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(subtitle, style: const TextStyle(color: kdsMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.amount,
    this.bold = false,
  });

  final String label;
  final int amount;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          'Tk $amount',
          style: TextStyle(
            fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
            fontSize: bold ? 18 : 14,
          ),
        ),
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.title,
    required this.subtitle,
    required this.active,
    required this.last,
  });

  final String title;
  final String subtitle;
  final bool active;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            CircleAvatar(
              radius: 12,
              backgroundColor: active ? kdsRedOrange : Colors.black12,
              child: active
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            if (!last)
              Container(
                width: 2,
                height: 48,
                color: active ? kdsRedOrange.withValues(alpha: .4) : Colors.black12,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(subtitle, style: const TextStyle(color: kdsMuted)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: kdsRedOrange),
              const SizedBox(height: 12),
              Text(
                value,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              Text(label, style: const TextStyle(color: kdsMuted)),
            ],
          ),
        ),
      ),
    );
  }
}
