import React from 'react';
import {
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacityProps,
  View,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/theme';

interface StyledInputProps extends TextInputProps {
  label: string;
}

export const StyledInput: React.FC<StyledInputProps> = ({ label, style, ...props }) => {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={Colors.textSecondary}
        {...props}
      />
    </View>
  );
};

interface StyledButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'google' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  icon,
  style,
  ...props
}) => {
  let buttonStyle = styles.buttonPrimary;
  let textStyle = styles.buttonTextPrimary;

  if (variant === 'google') {
    buttonStyle = styles.buttonGoogle;
    textStyle = styles.buttonTextGoogle;
  } else if (variant === 'outline') {
    buttonStyle = styles.buttonOutline;
    textStyle = styles.buttonTextOutline;
  }

  return (
    <TouchableOpacity
      style={[styles.button, buttonStyle, style, props.disabled && styles.buttonDisabled]}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'google' ? '#333' : '#fff'} />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text style={[styles.buttonText, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);

export const PageSubtitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.subtitle}>{children}</Text>
);

export const Message: React.FC<{ children: React.ReactNode; type?: 'success' | 'error' }> = ({
  children,
  type = 'success',
}) => (
  <View style={[styles.msg, type === 'error' && styles.msgError]}>
    <Text style={[styles.msgText, type === 'error' && styles.msgTextError]}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: Colors.textSecondary,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexDirection: 'row',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonGoogle: {
    backgroundColor: Colors.surface,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: 'white',
  },
  buttonTextGoogle: {
    color: Colors.textPrimary,
  },
  buttonTextOutline: {
    color: Colors.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 16,
  },
  msg: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  msgError: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.error,
  },
  msgText: {
    color: Colors.success,
    textAlign: 'center',
    fontWeight: '500',
  },
  msgTextError: {
    color: Colors.error,
  },
});
