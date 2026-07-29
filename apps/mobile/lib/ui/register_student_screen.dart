import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

/// A Sheikh registers a pupil straight from the classroom. It lands as
/// PENDING until the secretariat verifies it — but the Sheikh can keep
/// recording progress for the pupil in the meantime (see StudentRecords docs).
class RegisterStudentScreen extends ConsumerStatefulWidget {
  final List<SchoolClass> classes;
  const RegisterStudentScreen({super.key, required this.classes});

  @override
  ConsumerState<RegisterStudentScreen> createState() => _RegisterStudentScreenState();
}

class _RegisterStudentScreenState extends ConsumerState<RegisterStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _admissionNo = TextEditingController();
  final _guardianName = TextEditingController();
  final _guardianPhone = TextEditingController();

  String? _classId;
  String? _streamId;
  String? _gender;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    if (widget.classes.isNotEmpty) _classId = widget.classes.first.id;
  }

  @override
  void dispose() {
    _fullName.dispose();
    _admissionNo.dispose();
    _guardianName.dispose();
    _guardianPhone.dispose();
    super.dispose();
  }

  List<SchoolStream> get _streams =>
      widget.classes.where((c) => c.id == _classId).firstOrNull?.streams ?? const [];

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _classId == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(repositoryProvider).registerStudent(
            classId: _classId!,
            streamId: _streamId,
            admissionNo: _admissionNo.text.trim(),
            fullName: _fullName.text.trim(),
            gender: _gender,
            guardianName: _guardianName.text.trim().isEmpty ? null : _guardianName.text.trim(),
            guardianPhone: _guardianPhone.text.trim().isEmpty ? null : _guardianPhone.text.trim(),
          );
      if (mounted) {
        Navigator.of(context).pop(true);
        showSnack(context, '${_fullName.text.trim()} submitted for verification');
      }
    } catch (e) {
      if (mounted) showSnack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register pupil')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline_rounded, size: 18, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'This goes to the secretariat for verification. You can start recording progress right away.',
                        style: TextStyle(fontSize: 12.5),
                      ),
                    ),
                  ],
                ),
              ),
              TextFormField(
                controller: _fullName,
                decoration: const InputDecoration(labelText: 'Full name'),
                textCapitalization: TextCapitalization.words,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _admissionNo,
                decoration: const InputDecoration(labelText: 'Admission number'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _classId,
                decoration: const InputDecoration(labelText: 'Class'),
                items: [
                  for (final c in widget.classes) DropdownMenuItem(value: c.id, child: Text(c.name)),
                ],
                onChanged: widget.classes.isEmpty
                    ? null
                    : (v) => setState(() {
                          _classId = v;
                          _streamId = null;
                        }),
                validator: (v) => v == null ? 'Required' : null,
              ),
              if (_streams.isNotEmpty) ...[
                const SizedBox(height: 14),
                DropdownButtonFormField<String?>(
                  initialValue: _streamId,
                  decoration: const InputDecoration(labelText: 'Stream (optional)'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('None')),
                    for (final s in _streams) DropdownMenuItem(value: s.id, child: Text(s.name)),
                  ],
                  onChanged: (v) => setState(() => _streamId = v),
                ),
              ],
              const SizedBox(height: 14),
              DropdownButtonFormField<String?>(
                initialValue: _gender,
                decoration: const InputDecoration(labelText: 'Gender (optional)'),
                items: const [
                  DropdownMenuItem<String?>(value: null, child: Text('N/A')),
                  DropdownMenuItem(value: 'MALE', child: Text('Male')),
                  DropdownMenuItem(value: 'FEMALE', child: Text('Female')),
                ],
                onChanged: (v) => setState(() => _gender = v),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _guardianName,
                decoration: const InputDecoration(labelText: 'Guardian name (optional)'),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _guardianPhone,
                decoration: const InputDecoration(labelText: 'Guardian phone (optional)'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: (_saving || widget.classes.isEmpty) ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : const Text('Submit for verification'),
              ),
              if (widget.classes.isEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  'No classes found for your school yet. Ask the secretariat to set them up.',
                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.error),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
